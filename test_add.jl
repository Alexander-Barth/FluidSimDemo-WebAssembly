# https://rob-blackbourn.github.io/blog/webassembly/wasm/array/arrays/javascript/c/2020/06/07/wasm-arrays.html

include("wasm_target.jl")

function add(a::Int32,b::Int32)
    return a+b
end

obj = build_obj(add, Tuple{Int32,Int32})

write("test_add.o", obj)
run(`wasm-ld --no-entry --export-all -o test_add.wasm test_add.o`)
run(`wasm2wat test_add.wasm`)
run(`node test_add_node.js`)
