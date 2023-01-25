# https://rob-blackbourn.github.io/blog/webassembly/wasm/array/arrays/javascript/c/2020/06/07/wasm-arrays.html

include("wasm_target.jl")

function add(a::Int32,b::Int32)
    return a+b
end

obj = build_obj(add, Tuple{Int32,Int32})

write("julia_add.o", obj)
run(`wasm-ld --no-entry --export-all -o julia_add.wasm julia_add.o`)
run(`wasm2wat julia_add.wasm`)
run(`node julia_add_node.js`)
