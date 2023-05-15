include("wasm_target.jl")

using FluidSimDemo
using FluidSimDemo:sw_boundary_conditions!, sw_initial_conditions!


# assume that we use 32-bit julia
@assert Int == Int32

# need to inline because of named tuples

function fluid_sim_step(grav,f,Δx,Δt,ntime,
                    mask,h,h_u,h_v,p,u,v,newu,newv)

    uv = (u,v)
    newuv = (newu,newv)
    Δxy = (Δx,Δx)
    h_uv = (h_u,h_v)
    config = (; Δxy,Δt,grav,h,h_uv,f)

    if ntime == 0
        @inline sw_initial_conditions!(config,mask,p,(u,v))
        @inline sw_boundary_conditions!(config,mask,(u,v))

        h .= 100
        h_u .= 100
        h_v .= 100
    end

    @inline sw_boundary_conditions!(config,mask,uv)
    @inline FluidSimDemo.Physics2D.free_surface!(config,ntime,mask,p,uv)
    @inline sw_boundary_conditions!(config,mask,uv)
    @inline FluidSimDemo.Physics2D.advection!(config,mask,uv,newuv)
    @inline sw_boundary_conditions!(config,mask,uv)
    return 0
end

obj = build_obj(fluid_sim_step, Tuple{
    Float32,
    Float32,
    Float32,
    Float32,
    Int32,
    MallocMatrix{Int32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32},
    MallocMatrix{Float32}
})

write("model.o", obj)

# heap base: 66560

# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o`)
