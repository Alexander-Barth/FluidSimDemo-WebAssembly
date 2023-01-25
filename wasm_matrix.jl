# https://rob-blackbourn.github.io/blog/webassembly/wasm/array/arrays/javascript/c/2020/06/07/wasm-arrays.html


include("wasm_target.jl")


function sum_matrix(matrix::MallocMatrix{T}) where T
    s = zero(T)
    for i in eachindex(matrix)
        s += matrix[i]
        # also mutate the matrix
        matrix[i] = matrix[i]+1
    end

    # return the sum
    return s
end

obj = build_obj(sum_matrix, Tuple{MallocMatrix{Float32}})

write("julia_matrix.o", obj)
run(`wasm-ld --no-entry --export-all -o julia_matrix.wasm julia_matrix.o`)
run(`wasm2wat julia_matrix.wasm`)
run(`node julia_matrix_node.js`)
