using Pkg
Pkg.activate("/home/abarth/src/FluidSimDemo-WebAssembly-update/")
include("../wasm_target.jl")

include("nlayers.jl")



# assume that we use 32-bit julia
@assert Int == Int32


function nlayer_step_init(n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom)
    if n == 0
        rng = LinearCongruentialGenerators(42)
        @inline nlayer_init!(dx,hm,h,u,rng)
    end

    @inline nlayer_step(n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom)
    return 0
end

#function nlayer_modes(A,work,eigenvalues)
function nlayer_modes(A)
    # info = Ref(Int32(0))
    # @ccall ssyev(Ref('N')::Ptr{Cchar},
    #       Ref('U')::Ptr{Cchar},
    #       Ref(size(A,2))::Ptr{Cint},
    #       pointer(A)::Ptr{Cfloat},
    #       Ref(size(A,1))::Ptr{Cint},
    #       pointer(eigenvalues)::Ptr{Cfloat},
    #       pointer(work)::Ptr{Cfloat},
    #       length(work)::Ptr{Cint},
    #       info::Ptr{Cint})::Ptr{Cvoid}
    # return info[]

    @ccall memset(pointer(A)::Ptr{Cint},1::Cint,5::Culong)::Ptr{Cvoid}
end

obj = build_obj(nlayer_step_init, Tuple{
    Int32,   # n
    Float32, # dx
    Float32, # dt
    Float32, # g
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


obj = build_obj(nlayer_modes, Tuple{
    MallocVector{Int32},

#    MallocMatrix{Float32}, # A
#    MallocVector{Float32}, # work
#    MallocMatrix{Float32}, # eigenvalues
})

write("nlayer_modes.o", obj)




# heap base: 66560

# size of the total memory
mem = 65536*16*2

# the linker needs memset
run(`clang --target=wasm32 --no-standard-libraries -c -o memset.o ../memset.c`)

run(`wasm-ld --initial-memory=$(mem) --no-entry --export-all -o model.wasm memset.o model.o nlayer_modes.o`)
