using Pkg; Pkg.activate("/home/abarth/src/FluidSimDemo-WebAssembly-update/")
cd("/home/abarth/src/FluidSimDemo-WebAssembly-update/")
include("wasm_target.jl")



"""
    saxpy(α::Float32,x::MallocVector{T},y::MallocVector{T})

Computes y .= y + α * x

It should be called saxpy! but a ! cannot be used in function names in
JavaScript.
"""
function saxpy(α::Float32,x::MallocVector{T},y::MallocVector{T}) where T
    x_p = pointer(x)
    y_p = pointer(y)

    n = length(x)
    incx = stride(x,1)
    incy = stride(y,1)

    offset = get_stack_pointer();
    offset -= sizeof(Int32)
    unsafe_store!(Ptr{Int32}(offset),n)
    n_p = offset

    offset -= sizeof(Float32)
    unsafe_store!(Ptr{Float32}(offset),α)
    α_p = offset

    offset -= sizeof(Int32)
    unsafe_store!(Ptr{Int32}(offset),incx)
    incx_p = offset

    offset -= sizeof(Int32)
    unsafe_store!(Ptr{Int32}(offset),incy)
    incy_p = offset

    set_stack_pointer(offset);

    ccall("extern f2c_saxpy", llvmcall, Cint, (
        Int32,
        Cint,
        Ptr{Cint},Int32,
        Ptr{Cint},Int32,
    ), n_p, α_p, x_p, incx_p, y_p, incy_p)

    return 0;
end

obj = build_obj(saxpy, Tuple{
    Float32,
    MallocVector{Float32},
    MallocVector{Float32},
})

write("test_saxpy.o", obj)
run(`clang --target=wasm32 --no-standard-libraries -c -o test_heap.o test_heap.c`)
run(`wat2wasm -r -o stack_pointer.o stack_pointer.wat`)
run(`wasm-ld --no-entry --export-all -o test_saxpy.wasm test_saxpy.o test_heap.o  saxpy.o  stack_pointer.o blas_wasi.a`)
run(`node test_saxpy_node.js`)
