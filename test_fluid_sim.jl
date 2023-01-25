# https://rob-blackbourn.github.io/blog/webassembly/wasm/array/arrays/javascript/c/2020/06/07/wasm-arrays.html


include("wasm_target.jl")

# assume that we use 32-bit julia
@assert Int == Int32

function interp(F,(fi,fj))
    fi = clamp(fi,1,size(F,1))
    fj = clamp(fj,1,size(F,2))

    i = min(unsafe_trunc(Int,fi),size(F,1)-1)
    j = min(unsafe_trunc(Int,fj),size(F,2)-1)

    a = fi - i
    b = fj - j

    return @inbounds (((1-a)*((1-b) * F[i,j]   + b * F[i,j+1]) +
                           a*((1-b) * F[i+1,j] + b * F[i+1,j+1])))
end

function incompressibility!(config,mask,p,(u,v))
    Δt,ρ,h = config.Δt,config.ρ,config.h

    cp = ρ * h / Δt

    # Gauss-Seidel
    @inbounds for iter = 1:config.iter_pressure
        for j = 2:size(mask,2)-1
            for i = 2:size(mask,1)-1

                @inbounds if mask[i,j] == 0
                    continue
                end

                #  number of direct neightbors with water
                nn = mask[i+1,j] + mask[i-1,j] + mask[i,j+1] + mask[i,j-1]

                if nn == 0
                    continue
                end

                div = (u[i+1,j] - u[i,j] + v[i,j+1] - v[i,j])
                p_ = -div/nn
                p_ *= config.overrelaxation
                # pressure
                p[i,j] += cp * p_

                u[i,j]   -= p_ * mask[i-1,j]
                u[i+1,j] += p_ * mask[i+1,j]
                v[i,j]   -= p_ * mask[i,j-1]
                v[i,j+1] += p_ * mask[i,j+1]
            end
        end
    end
end

function advection!(config,mask,(u,v),(newu,newv))
    T = eltype(u)
    Δt,h = config.Δt,config.h

    @inbounds for j = 2:size(mask,2)-1
        for i = 2:size(mask,1)
            if (mask[i,j] == 1) && (mask[i-1,j] == 1)
                v_u = T(0.25) * (v[i,j] + v[i,j+1] + v[i-1,j] + v[i-1,j+1])
                fi = i + (-u[i,j] * Δt)/h
                fj = j + (-v_u * Δt)/h
                newu[i,j] = interp(u,(fi,fj))
            end
        end
    end

    @inbounds for j = 2:size(mask,2)
        for i = 2:size(mask,1)-1
            if (mask[i,j] == 1) && (mask[i,j-1] == 1)
                u_v = T(0.25) * (u[i,j] + u[i+1,j] + u[i,j-1] + u[i+1,j-1])
                fi = i + (-u_v * Δt)/h
                fj = j + (-v[i,j] * Δt)/h
                newv[i,j] = interp(v,(fi,fj))
            end
        end
    end

    @inbounds for ij = eachindex(u)
        u[ij] = newu[ij]
    end
    @inbounds for ij = eachindex(v)
        v[ij] = newv[ij]
    end
end

function set_mask!(config,mask,xy)
    radius = 0.15
    h = config.h

    @inbounds for ij = eachindex(mask)
        mask[ij] = true
    end

    @inbounds for j = 2:size(mask,2)-1
        for i = 2:size(mask,1)-1
            dx = (i-1 + 0.5) * h - xy[1]
            dy = (j-1 + 0.5) * h - xy[2]

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

function boundary_conditions!(config,(u,v))
    sz = (size(u,1)-1,size(u,2))

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

function fluid_sim_step(u0,h,Δt,ρ,overrelaxation,iter_pressure,
                    mask,p,u,v,newu,newv)

    uv = (u,v)
    newuv = (newu,newv)
    xy = (0.4,0.5)
    config = (; u0,h,Δt,ρ,overrelaxation,iter_pressure,
              xy)

    @inline set_mask!(config,mask,xy)
    p .= 0
    @inline incompressibility!(config,mask,p,uv)
    @inline boundary_conditions!(config,uv)
    @inline advection!(config,mask,uv,newuv)
    @inline boundary_conditions!(config,uv)
    return 0
end

obj = build_obj(fluid_sim_step, Tuple{
    Float32,
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
    MallocMatrix{Float32}
})

write("test_fluid_sim.o", obj)

# size of the total memory
mem = 65536*16

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o test_fluid_sim.wasm memset.o test_fluid_sim.o`)

