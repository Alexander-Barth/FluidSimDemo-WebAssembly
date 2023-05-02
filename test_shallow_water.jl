include("wasm_target.jl")

using FluidSimDemo
using FluidSimDemo:sw_boundary_conditions!, sw_initial_conditions!


# assume that we use 32-bit julia
@assert Int == Int32


function set_mask!(config,mask,xy)
    radius = 0.15
    Δx,Δy = config.Δxy

    @inbounds for ij = eachindex(mask)
        mask[ij] = true
    end

    @inbounds for j = 2:size(mask,2)-1
        for i = 2:size(mask,1)-1
            dx = (i-1 + 0.5) * Δx - xy[1]
            dy = (j-1 + 0.5) * Δy - xy[2]

            @inbounds if dx^2 + dy^2 < radius^2
                mask[i,j] = false
                #mask[i,j] += 1
            end
        end
    end


    @inbounds for j = 1:size(mask,2)
        mask[1,j] = false
    end

    @inbounds for i = 1:size(mask,1)
        mask[i,1] = false
        mask[i,end] = false
    end
end

function boundary_conditions!(config,mask,(u,v))
    sz = (size(u,1)-1,size(u,2))

    # mask can change
    @inbounds for j = 1:size(mask,2)
        for i = 2:size(mask,1)
            if mask[i,j] == 0
                u[i,j] = 0
                u[i+1,j] = 0
                v[i,j] = 0
                v[i,j+1] = 0
            end
        end
    end

    # inflow
    @inbounds for j = 1:size(u,2)
        u[2,j] = config.u0
        # semi-lagrangian advection might query values on land
        u[1,j] = u[2,j]
    end

    @inbounds for i = 1:size(u,1)
        u[i,1] = u[i,2]
        u[i,end] = u[i,end-1]
    end
    @inbounds for j = 1:size(v,2)
        v[1,j] = v[2,j]
        v[end,j] = v[end-1,j]
    end
end

# need to inline because of named tuples

function fluid_sim_step(u0,Δx,Δt,ρ,overrelaxation,iter_pressure,ntime,
                    mask,h,h_u,h_v,p,u,v,newu,newv)

    uv = (u,v)
    newuv = (newu,newv)
    xy = (0.4,0.5)
    Δxy = (Δx,Δx)
    grav = 9.81f0
    h_uv = (h_u,h_v)
    config = (; u0,Δxy,Δt,ρ,overrelaxation,iter_pressure,grav,h,h_uv,
              xy)

    if ntime == 0
        @inline sw_initial_conditions!(config,mask,p,(u,v))
        @inline sw_boundary_conditions!(config,mask,(u,v))

        h .= 1
        h_u .= 1
        h_v .= 1
    end

    @inline sw_boundary_conditions!(config,mask,uv)
    @inline FluidSimDemo.Physics2D.free_surface!(config,mask,p,uv)
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
    Float32,
    Int32,
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

write("test_shallow_water.o", obj)

# heap base: 66560

# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o test_shallow_water.wasm memset.o test_shallow_water.o`)
