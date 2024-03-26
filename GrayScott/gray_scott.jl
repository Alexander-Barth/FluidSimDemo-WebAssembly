#=
Chemical reaction
U + 2V → 3V
V → P

Equations

∂u/∂t = Dᵤ ∇²u - u v² + f (1 - u)
∂v/∂t = Dᵥ ∇²v + u v² - (f + k) v

on a domain of 258 x 258 grid point with a spatial resolution
of Δx = 1 and a time step Δt = 1. At the boundary u and v are set to
zero.

Initial condition

For (x,y) inside a centred box of 20x20 grid cells

u(x,y,0) = 0.5 + ϵ
v(x,y,0) = 0.25 + ϵ

else where

u(x,y,0) = 1 + ϵ
v(x,y,0) = ϵ

where ϵ a random variable uniformly distributed over -0.05 and 0.05.


Time stepping:
Euler forward:
du/dt ≈ (u(x,y,t+Δt) - u(x,y,t)) / Δt

Laplacian:
∇²u
=#
#using PyPlot
#using Plots
import Random: rand, AbstractRNG

push!(LOAD_PATH,dirname(@__FILE__))

using GrayScott


include("../wasm_target.jl")


# Based on
# https://www.labri.fr/perso/nrougier/from-python-to-numpy/code/gray_scott.py
# by Nicolas P. Rougier - BSD license

sz = (256,256)

#Du, Dv, f, k = 0.16, 0.08, 0.035, 0.065  # Bacteria 1
#Du, Dv, f, k = 0.14, 0.06, 0.035, 0.065  # Bacteria 2
Du, Dv, f, k = 0.16, 0.08, 0.060, 0.062  # Coral
#Du, Dv, f, k = 0.19, 0.05, 0.060, 0.062  # Fingerprint
#Du, Dv, f, k = 0.10, 0.10, 0.018, 0.050  # Spirals
#Du, Dv, f, k = 0.12, 0.08, 0.020, 0.050  # Spirals Dense
#Du, Dv, f, k = 0.10, 0.16, 0.020, 0.050  # Spirals Fast
#Du, Dv, f, k = 0.16, 0.08, 0.020, 0.055  # Unstable
#Du, Dv, f, k = 0.16, 0.08, 0.050, 0.065  # Worms 1
#Du, Dv, f, k = 0.16, 0.08, 0.054, 0.063  # Worms 2
#Du, Dv, f, k = 0.16, 0.08, 0.035, 0.060  # Zebrafish



T = Float32
T = Float64

Δx = T(1)
Δt = T(1)
r = 20

(Du, Dv, f, k) = T.((Du, Dv, f, k))
u = zeros(T,sz)
v = zeros(T,sz)
un = zeros(T,sz)
vn = zeros(T,sz)



function model_step(Δx,Δt,Du,Dv,f,k,r,ntime,mask,u,v,un,vn)
    sz = size(u)
    rng = LinearCongruentialGenerators(42)

    if ntime == 0
        @inbounds for j = 1:sz[2]
            for i = 1:sz[1]
                v[i,j] = 0

                if (i ∈ (1,sz[1])) || (j ∈ (1,sz[2]))
                    u[i,j] = 0
                else
                    u[i,j] = 1

                    if (abs(i - sz[1]÷2) <= r) && (abs(j - sz[2]÷2) <= r)
                        u[i,j] = 0.5
                        v[i,j] = 0.25
                    end

                    u[i,j] += 0.05 * rand(rng,Float32)
                    v[i,j] += 0.05 * rand(rng,Float32)
                end
            end
        end
    end

    Duv = (Du,Dv)
    Δxy = (Δx,Δx)
    invΔxy = 1 ./ Δxy
    #invΔxy =  Δxy
    config = (; Δxy,invΔxy,Δt,Duv,f,k)
    @inline GrayScott.step!(config,mask,(u,v),(un,vn))
    return 1
end

nmax = 10000000
nmax = 1000
nmax = 1000

mask = ones(Int32,sz)
n = 0
@time model_step(Δx,Δt,Du,Dv,f,k,r,n,mask,u,v,un,vn)

#u_save = copy(u)
@show maximum(abs.(u_save - u))

#@time model_step(Δx,Δt,Du,Dv,f,k,r,n,u,v,un,vn)
#@time model_step(Δx,Δt,Du,Dv,f,k,r,n,u,v,un,vn)



#=
for n = 0:nmax
    model_step(Δx,Δt,Du,Dv,f,k,r,n,u,v,un,vn)

    if n % 10 == 0
        @show n
        #=
        pcolormesh(u')
        PyPlot.draw()
        sleep(0.001)
        =#
        display(heatmap(v'))
    end
end
=#
#=
obj = build_obj(model_step, Tuple{
    Float32,
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
})


write("model.o", obj)


# size of the total memory
mem = 65536*16*2
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o`)
=#
