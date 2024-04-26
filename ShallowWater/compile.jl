include("../wasm_target.jl")

using FluidSimDemo
using FluidSimDemo:sw_boundary_conditions!, sw_initial_conditions!


# assume that we use 32-bit julia
@assert Int == Int32

# need to inline because of named tuples

function fluid_sim_step(grav,bottom_depth,f₀,β,Δx,Δt,ntime,
                    mask,fCoriolis,h,h_u,h_v,p,u,v,newu,newv)

    uv = (u,v)
    newuv = (newu,newv)
    Δy = Δx
    Δxy = (Δx,Δy)
    h_uv = (h_u,h_v)
    config = (; Δxy,Δt,grav,h,h_uv,fCoriolis)

    if ntime == 0
        @inline sw_initial_conditions!(config,mask,p,(u,v))
        @inline sw_boundary_conditions!(config,mask,(u,v))

        h .= bottom_depth
        h_u .= bottom_depth
        h_v .= bottom_depth
    end

    @inbounds for j = 1:size(mask,2)
        for i = 1:size(mask,1)
            y = (j-size(mask,2)/2)*Δy
            fCoriolis[i,j] = f₀ + β * y
        end
    end

    @inline sw_boundary_conditions!(config,mask,uv)
    @inline FluidSimDemo.Physics2D.free_surface!(config,ntime,mask,p,uv)
    @inline sw_boundary_conditions!(config,mask,uv)
    @inline FluidSimDemo.Physics2D.advection!(config,mask,uv,newuv)
    @inline sw_boundary_conditions!(config,mask,uv)
    return 0
end

obj = build_obj(fluid_sim_step, Tuple{
    Float32,                  # grav
    Float32,                  # bottom_depth
    Float32,                  # f₀
    Float32,                  # β
    Float32,                  # Δx
    Float32,                  # Δt
    Int32,                    # ntime
    MallocMatrix{Int32},      # mask
    MallocMatrix{Float32},    # fCoriolis
    MallocMatrix{Float32},    # h
    MallocMatrix{Float32},    # h_u
    MallocMatrix{Float32},    # h_v
    MallocMatrix{Float32},    # p
    MallocMatrix{Float32},    # u
    MallocMatrix{Float32},    # v
    MallocMatrix{Float32},    # newu
    MallocMatrix{Float32}     # newv
})

write("model.o", obj)

# heap base: 66560

# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o`)
