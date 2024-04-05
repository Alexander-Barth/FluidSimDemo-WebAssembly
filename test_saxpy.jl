include("wasm_target.jl")

"""
    saxpy(α::Float32,x::AbstractVector{T},y::AbstractVector{T})

Computes y .= y + α * x

It should be called saxpy! but a ! cannot be used in function names in
JavaScript.
"""
function saxpy(α::Float32,x::AbstractVector{T},y::AbstractVector{T}) where T
    n = length(x)
    incx = stride(x,1)
    incy = stride(y,1)

    ccall("extern f2c_saxpy", llvmcall, Cint, (
        Ptr{Cint},
        Ptr{Cint},
        Ptr{Cint},
        Ptr{Cint},
        Ptr{Cint},
        Ptr{Cint},
    ), push_stack(n),
          push_stack(α),
          pointer(x),
          push_stack(incx),
          pointer(y),
          push_stack(incy))

    return 0;
end

obj = build_obj(saxpy, Tuple{
    Float32,
    MallocVector{Float32},
    MallocVector{Float32},
})

write("test_saxpy.o", obj)
run(`wat2wasm -r -o stack_pointer.o stack_pointer.wat`)
run(`wasm-ld --no-entry --export-all -o test_saxpy.wasm test_saxpy.o saxpy.o  stack_pointer.o blas_wasi.a`)
run(`node test_saxpy_node.js`)
