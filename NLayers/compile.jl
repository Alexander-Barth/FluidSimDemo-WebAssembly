using Pkg
include("../wasm_target.jl")
include("nlayers.jl")

# assume that we use 32-bit julia
@assert Int == Int32


function nlayer_init(dx,modeindex,rho,hm,h,u,
                     eigenvalues,eigenvectors,potential_matrix,work1,work2,
                     )

    rng = LinearCongruentialGenerators(42)
    tol = 1e-5
    @inline nlayer_init!(
        dx,modeindex,hm,h,u,rho,
        eigenvalues,eigenvectors,potential_matrix,tol,work1,work2,
        rng)
end


obj = build_obj(nlayer_step, Tuple{
    Int32,   # n
    Float32, # dx
    Float32, # dt
    Float32, # g
    MallocVector{Float32}, # rho
    MallocMatrix{Float32}, # P
    MallocMatrix{Float32}, # h
    MallocMatrix{Float32}, # hm
    MallocMatrix{Float32}, # hu
    MallocMatrix{Float32}, # u
    MallocMatrix{Float32}, # z
    MallocVector{Float32}, # bottom
})


write("model.o", obj)

obj = build_obj(nlayer_init, Tuple{
    Float32, # dx
    Int32, # modeindex
    MallocVector{Float32}, # rho,
    MallocMatrix{Float32}, # hm
    MallocMatrix{Float32}, # h
    MallocMatrix{Float32}, # u
    MallocVector{Float32}, # eigenvalues
    MallocMatrix{Float32}, # eigenvectors
    MallocMatrix{Float32}, # potential_matrix
    MallocMatrix{Float32}, # work1
    MallocMatrix{Float32}, # work2
})

write("nlayer_init.o", obj)


# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)
run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o nlayer_init.o model.o`)
