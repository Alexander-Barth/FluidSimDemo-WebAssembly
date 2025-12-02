include("wasm_target.jl")




function sum_matrix(matrix::MallocMatrix{T}) where T
    s = zero(T)
    for i in eachindex(matrix)
        s += matrix[i]
        # also mutate the matrix
        matrix[i] = matrix[i]+1
    end

    # return the sum
    #return s
    #return pointer(matrix)
    #matrix[2] += 1
    return s
end

obj = build_obj(sum_matrix, Tuple{MallocMatrix{Float32}})

write("test_matrix.o", obj)
run(`wasm-ld -mwasm64 --no-entry --export-all -o test_matrix.wasm test_matrix.o`)
run(`wasm2wat --enable-memory64 test_matrix.wasm`)
run(`node --experimental-wasm-memory64 test_matrix_node.js`)
