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

function model_step(grav,f,Δx,Δt,ntime,
                    mask,
                    particles,
                    )
    rng = LinearCongruentialGenerators(42)

    config,particles,W_spiky,W_rho =
        SmoothedParticleHydrodynamics.case_dam_break!(
            particles,
            init_particles = ntime == 0,
            Δt = Δt,
            g = (0, -grav),
            rng = rng,
        )

    update!(config,W_spiky,W_rho,particles)
    return 0
end

nparticles = 1219
grav,f,Δx = 9.81f0,0f0,0f0
Δt = 0.0007f0
mask = MallocMatrix{Int32}(undef,(20,20))
particles = MallocVector{Particle{2,Float32}}(undef,(nparticles,))
ntime = 0

length(particles)

@time model_step(
    grav,f,Δx,Δt,ntime,
    mask,
    particles,
)

ntime = 1
@time model_step(
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

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm model.o`)


