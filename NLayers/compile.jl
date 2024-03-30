using Pkg
Pkg.activate("/home/abarth/src/FluidSimDemo-WebAssembly-update/")
include("../wasm_target.jl")

include("nlayers.jl")



# assume that we use 32-bit julia
#@assert Int == Int32


function nlayer_step_init(n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom)
    if n == 0
        rng = LinearCongruentialGenerators(42)
        nlayer_init!(dx,hm,h,u,rng)
    end

    nlayer_step(n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom)
    return 0
end

obj = build_obj(nlayer_step_init, Tuple{
    Int32,
    Float32,
    Float32,
    Float32,
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

# heap base: 66560

# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o`)
