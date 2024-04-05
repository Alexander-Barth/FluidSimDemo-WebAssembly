include("wasm_target.jl")


get_stack_pointer() = ccall("extern get_stack_pointer", llvmcall, Cint, ())
set_stack_pointer(p) = ccall("extern set_stack_pointer", llvmcall, Cvoid, (Cint,),p)

# https://surma.dev/things/c-to-webassembly/


# ┌───────────────┬─────────────────────┬────────────────────────┐
# │ data          │             ← stack │ heap →                 │
# └───────────────┴─────────────────────┴────────────────────────┘
# 0         __data_end            __heap_base
#
# The stack grows downwards and the heap grows upwards.
# LLVM uses __stack_pointer
# see stack_pointer.wat

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
run(`wat2wasm -r -o saxpy.o saxpy.wat`)
run(`wat2wasm -r -o stack_pointer.o stack_pointer.wat`)
#run(`clang --target=wasm32 --no-standard-libraries -c -o saxpy.o saxpy.c`)
run(`wasm-ld --no-entry --export-all -o test_saxpy.wasm test_saxpy.o test_heap.o  saxpy.o  stack_pointer.o blas_wasi.a`)
#run(`wasm2wat test_saxpy.wasm`)
run(`node test_saxpy_node.js`)