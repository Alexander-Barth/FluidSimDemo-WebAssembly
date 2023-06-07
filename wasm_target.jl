# adapted from
# https://seelengrab.github.io/articles/Running%20Julia%20baremetal%20on%20an%20Arduino/

using GPUCompiler
using LLVM
using StaticTools

#####
# Compiler Target
#####

struct WASMTarget <: GPUCompiler.AbstractCompilerTarget end

GPUCompiler.llvm_triple(::WASMTarget) = "wasm32-unknown-wasi"
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

GPUCompiler.runtime_module(::GPUCompiler.CompilerJob{<:Any,WASMTargetParams}) = StaticRuntime
GPUCompiler.runtime_module(::GPUCompiler.CompilerJob{WASMTarget}) = StaticRuntime
GPUCompiler.runtime_module(::GPUCompiler.CompilerJob{WASMTarget,WASMTargetParams}) = StaticRuntime


function wasm_job(@nospecialize(func), @nospecialize(types))
    @info "Creating compiler job for '$func($types)'"
    source = methodinstance(typeof(func), types)
    target = WASMTarget()
    params = WASMTargetParams()
    # per default the function name will use C++ name mangling (GPUCompiler 0.19)
    # for example _Z3add5Int32S_ for add(Int32, Int32) (see llvm-cxxfilt)
    # here we will prefix a function with julia_ as it was the default in
    # GPUCompiler 0.17
    config = GPUCompiler.CompilerConfig(target, params, name = string("julia_",func))
    job = GPUCompiler.CompilerJob(source, config)
end

function build_ir(job, @nospecialize(func), @nospecialize(types))
    @info "Bulding LLVM IR for '$func($types)'"
    ir, ir_meta = GPUCompiler.emit_llvm(
        job, # our job
        libraries=false, # whether this code uses libraries
        deferred_codegen=false, # is there runtime codegen?
        optimize=true, # do we want to optimize the llvm?
        only_entry=false, # is this an entry point?
        validate = false,
        ctx=JuliaContext()) # the LLVM context to use
    return ir, ir_meta
end

function build_obj(@nospecialize(func), @nospecialize(types); kwargs...)
    job = wasm_job(func, types)
    @info "Compiling WASM ASM for '$func($types)'"
    ir, ir_meta = build_ir(job, func, types)
    obj, _ = GPUCompiler.emit_asm(
                job, # our job
                ir; # the IR we got
                strip=true, # should the binary be stripped of debug info?
                validate=true, # should the LLVM IR be validated?
                format=LLVM.API.LLVMObjectFile) # What format would we like to create?
    return obj
end
