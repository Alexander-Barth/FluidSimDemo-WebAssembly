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


function sum_matrix(A::MallocMatrix{T},B::MallocMatrix{T},C::MallocMatrix{T}) where T
    s = zero(T)
    for i in eachindex(A)
        s += A[i]
        # also mutate the A
#        A[i] = A[i]+1
    end

    # TRANSA = 'N'
    # TRANSB = 'N'
    # M = 2
    # N = 2
    # K = 2
    # ALPHA = 1f0
    # LDA = size(A,1)
    # LDB = size(B,1)
    # BETA = 0f0
    # LDC = size(C,1)

    # sgemm(
    #     TRANSA,
    #     TRANSB,
    #     M,
    #     N,
    #     K,
    #     ALPHA,
    #     pointer(A),
    #     LDA,
    #     pointer(B),
    #     LDB,
    #     BETA,
    #     pointer(C),
    #     LDC,
    # )
    x = pointer(A)
    y = pointer(B)

    n = 2
    alpha = 1f0
    incx = 1
    incy = 1

    offset = get_stack_pointer();
    offset -= sizeof(Int32)
    unsafe_store!(Ptr{Int32}(offset),n)
    n_p = offset

    offset -= sizeof(Float32)
    unsafe_store!(Ptr{Float32}(offset),alpha)
    alpha_p = offset

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
    ), n_p, alpha_p, x, incx_p, y, incy_p)

    # ccall("extern saxpy", llvmcall, Cint, (
    #     Int32,
    #     Float32,
    #     Ptr{Cint},Int32,
    #     Ptr{Cint},Int32,
    # ), n, alpha, x, incx, y, incy)

    rr = ccall("extern get_stack_pointer", llvmcall, Cint, ())

    ccall("extern set_stack_pointer", llvmcall, Cvoid, (Cint,),122)
    rr = ccall("extern get_stack_pointer", llvmcall, Cint, ())

    return rr;
end

obj = build_obj(sum_matrix, Tuple{
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
})

write("test_matrix_lapack.o", obj)
run(`clang --target=wasm32 --no-standard-libraries -c -o test_heap.o test_heap.c`)
run(`wat2wasm -r -o saxpy.o saxpy.wat`)
run(`wat2wasm -r -o stack_pointer.o stack_pointer.wat`)
#run(`clang --target=wasm32 --no-standard-libraries -c -o saxpy.o saxpy.c`)
run(`wasm-ld --no-entry --export-all -o test_matrix_lapack.wasm test_matrix_lapack.o test_heap.o  saxpy.o  stack_pointer.o blas_wasi.a`)
#run(`wasm2wat test_matrix_lapack.wasm`)
run(`node test_matrix_lapack_node.js`)
