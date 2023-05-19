include("../wasm_target.jl")

using SmoothedParticleHydrodynamics
using SmoothedParticleHydrodynamics: Particle, W, update!
using StableRNGs
using Random
import Random: rand, AbstractRNG
# assume that we use 32-bit julia
@assert Int == Int32

# need to inline because of named tuples


seed = 123456789
m = Int64(2)^31

mutable struct LinearCongruentialGenerators <: AbstractRNG
    seed::Int32
end

struct LinearCongruentialGenerators2 <: AbstractRNG
    seed::Int32
end

struct LinearCongruentialGenerators3 <: AbstractRNG
    seed::Ref{Int32}
end

rng = LinearCongruentialGenerators(42)

function rand(rng::LinearCongruentialGenerators,::Type{Int32})
    m = Int64(1) << 31
    a = 1103515245
    c = 12345
    rng.seed = Int32((a * rng.seed + c) % m)
    return rng.seed
end

function rand(rng::LinearCongruentialGenerators,::Type{Float32})
    r = Int64(typemax(Int32)) - typemin(Int32)
    return (Int64(rand(rng,Int32)) - typemin(Int32))/Float32(r)
end

# rand(rng,Float32)

function model_step(grav,f,Δx,Δt,ntime,
                    mask,
                    particles,
                    )


#    rng = StableRNG(123)
#    rng = Random.GLOBAL_RNG;
    rng = LinearCongruentialGenerators(42)
#    rng = LinearCongruentialGenerators2(42)
#    rng = LinearCongruentialGenerators3(42)
#    rng = 42

    config,particles,W_spiky,W_rho =
        SmoothedParticleHydrodynamics.case_dam_break2!(#rng,
            particles,
            init_particles = ntime == 0,
            rng = rng,
        )

    update!(config,W_spiky,W_rho,particles)
    return 0
end

grav,f,Δx,Δt,ntime = 0,0,0,0,0
mask = MallocMatrix{Int32}(undef,(20,20))
particles = MallocVector{Particle{2,Float32}}(undef,(20,))

model_step(
    grav,f,Δx,Δt,ntime,
    mask,
    particles,
)

obj = build_obj(model_step, Tuple{
    Float32,
    Float32,
    Float32,
    Float32,
    Int32,
    MallocMatrix{Int32},
    MallocVector{Particle{2,Float32}},
})

write("model.o", obj)


# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o`)
