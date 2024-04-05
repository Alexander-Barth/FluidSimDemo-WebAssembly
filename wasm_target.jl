# Compiler Target adapted from
# https://seelengrab.github.io/articles/Running%20Julia%20baremetal%20on%20an%20Arduino/

using GPUCompiler
using StaticTools

#####
# Compiler Target
#####

struct WASMTarget <: GPUCompiler.AbstractCompilerTarget end

GPUCompiler.llvm_triple(::WASMTarget) = "wasm32-unknown-wasi"
#GPUCompiler.llvm_triple(::WASMTarget) = "wasm64-unknown-wasi"
GPUCompiler.runtime_slug(::GPUCompiler.CompilerJob{WASMTarget}) = "wasm-test"

struct WASMTargetParams <: GPUCompiler.AbstractCompilerParams end


module StaticRuntime
    # the runtime library
    signal_exception() = return
    malloc(sz) = C_NULL
    report_oom(sz) = return
    report_exception(ex) = return
    report_exception_name(ex) = return
    report_exception_frame(idx, func, file, line) = return
end

GPUCompiler.runtime_module(::GPUCompiler.CompilerJob{WASMTarget}) = StaticRuntime
GPUCompiler.uses_julia_runtime(::GPUCompiler.CompilerJob{WASMTarget}) = false
GPUCompiler.can_throw(::GPUCompiler.CompilerJob{WASMTarget}) = false

function wasm_job(@nospecialize(func), @nospecialize(types))
    @info "Creating compiler job for '$func($types)'"
    source = methodinstance(typeof(func), types)
    target = WASMTarget()
    params = WASMTargetParams()
    # per default the function name will use C++ name mangling (GPUCompiler 0.19)
    # for example _Z3add5Int32S_ for add(Int32, Int32) (see llvm-cxxfilt)
    # here we will prefix a function with julia_ as it was the default in
    # GPUCompiler 0.17
    config = GPUCompiler.CompilerConfig(
        target,
        params,
        kernel = false,
        name = string("julia_",func),
    )
    job = GPUCompiler.CompilerJob(source, config)
end

function build_obj(@nospecialize(func), @nospecialize(types); kwargs...)
    job = wasm_job(func, types)
    @info "Compiling WASM for '$func($types)'"
    target = :obj

    obj = GPUCompiler.JuliaContext() do ctx
        GPUCompiler.compile(
            target,job;
            libraries=false,
            validate = false,
            strip=true)[1]
    end
    return obj
end



# https://surma.dev/things/c-to-webassembly/
# ┌───────────────┬─────────────────────┬────────────────────────┐
# │ data          │             ← stack │ heap →                 │
# └───────────────┴─────────────────────┴────────────────────────┘
# 0         __data_end            __heap_base
#
# The stack grows downwards and the heap grows upwards.
# LLVM uses __stack_pointer
# see stack_pointer.wat


get_stack_pointer() =
    Ptr{Nothing}(ccall("extern get_stack_pointer", llvmcall, Cint, ()))
set_stack_pointer(p) =
    ccall("extern set_stack_pointer", llvmcall, Cvoid, (Cint,),Cint(p))

# even unsafer than unsafe_store!
unsafer_store!(p::Ptr{Nothing},v::T) where T = unsafe_store!(Ptr{T}(p),v)


# simple RNG

import Random: rand, AbstractRNG

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
