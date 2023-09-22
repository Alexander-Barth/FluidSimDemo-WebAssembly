include("../wasm_target.jl")

using SmoothedParticleHydrodynamics
using SmoothedParticleHydrodynamics: Particle, W, update!
using Random
import Random: rand, AbstractRNG
# assume that we use 32-bit julia
@assert Int == Int32

# need to inline because of named tuples


seed = 123456789
m = Int64(2)^31


function model_step(grav,f,Δx,Δt,ntime,imax,jmax,
                    mask,
                    particles,
                    table,
                    num_particles,
                    visited,
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

    sz = (imax,jmax)
    spatial_index = (; table, num_particles, config.h)
    update!(config,W_spiky,W_rho,particles,spatial_index,visited)
    return 0
    #return SmoothedParticleHydrodynamics.lanczos_gamma(f + 20.0)

    # if f > 1000
    #     error("foo");
    # end
    # return 0
end

nparticles = 1219
grav,f,Δx = 9.81f0,0f0,0f0
Δt = 0.0007f0
mask = MallocMatrix{Int32}(undef,(20,20))
particles = MallocVector{Particle{2,Float32}}(undef,(nparticles,))

limits = (1200,900)
h = 16.f0

# 76 x 57
sz = unsafe_trunc.(Int,limits ./ h) .+ 1
# 4333
table = zeros(Int,prod(sz)+1)
num_particles = zeros(Int,length(particles))
visited = zeros(Int,length(particles))
limits = Tuple(limits)


length(particles)
ntime = 0

@time model_step(
    grav,f,Δx,Δt,ntime,sz[1],sz[2],
    mask,
    particles,
    table,
    num_particles,
    visited,
)

@time model_step(
    grav,f,Δx,Δt,ntime,sz[1],sz[2],
    mask,
    particles,
    table,
    num_particles,
    visited,
)

ntime = 1
@time model_step(
    grav,f,Δx,Δt,ntime,sz[1],sz[2],
    mask,
    particles,
    table,
    num_particles,
    visited,
)

obj = build_obj(model_step, Tuple{
    Float32,
    Float32,
    Float32,
    Float32,
    Int32,
    Int32,
    Int32,
    MallocMatrix{Int32},
    MallocVector{Particle{2,Float32}},
    MallocMatrix{Int32},
    MallocMatrix{Int32},
    MallocMatrix{Int32},
})


write("model.o", obj)


# size of the total memory
mem = 65536*16*2
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

# using https://github.com/llvm/llvm-project/tree/main/compiler-rt/lib/builtins
# $ clang --target=wasm32 --no-standard-libraries -c ashlti3.c
# $ clang --target=wasm32 --no-standard-libraries -c lshrti3.c

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o lshrti3.o ashlti3.o model.o`)




