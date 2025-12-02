include("wasm_target.jl")

using FluidSimDemo
using FluidSimDemo.Physics2D: incompressibility!, advection!
using FluidSimDemo: boundary_conditions!, set_mask!

function fluid_sim_step(u0,h,Δt,ρ,overrelaxation,iter_pressure,ntime,
                    mask,p,u,v,newu,newv)

    uv = (u,v)
    newuv = (newu,newv)
    # position and radius of obstacle
    xy = (0.4,0.5)
    radius = 0.15
    Δxy = (h,h)
    config = (; u0,h,Δxy,Δt,ρ,overrelaxation,iter_pressure)

    if ntime == 0
        set_mask!(config,mask,xy,uv; radius = radius)
    end

    p .= 0
    boundary_conditions!(config,mask,uv)
    incompressibility!(config,mask,p,uv)
    boundary_conditions!(config,mask,uv)
    advection!(config,mask,uv,newuv)
    boundary_conditions!(config,mask,uv)
    return 0
end

obj = build_obj(fluid_sim_step, Tuple{
    Float32,
    Float32,
    Float32,
    Float32,
    Float32,
    Int32,
    Int32,
    MallocMatrix{Int32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32}
})

write("test_fluid_sim.o", obj)

# size of the total memory
mem = 65536*16

# the linker needs memset
run(`clang --target=wasm64 --no-standard-libraries -c -o memset.o memset.c`)

run(`wasm-ld -mwasm64 --initial-memory=$(mem) --no-entry --export-all -o test_fluid_sim.wasm memset.o test_fluid_sim.o`)
