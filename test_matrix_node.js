// Assume add.wasm file exists that contains a single function adding 2 provided arguments
const fs = require('fs');

const wasmBuffer = fs.readFileSync('test_matrix.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
  // Exported function live under instance.exports
  const { julia_sum_matrix, memory } = wasmModule.instance.exports;

    // Create an array that can be passed to the WebAssembly instance.
    // memory64 uses little-endian, while
    // the endianess of BigInt64Array is platform-dependent
    const array = new Int32Array(memory.buffer, 0, 8)

    // data starts after 4 Int64:
    // pointer, total length, size 1, size 2
    // data starts directly after the metadata
    // we use offset,0 rather than 0,offset because wasm is little-endian
    offset = 4*8
    array.set([offset, 0, 6, 0, 2, 0, 3, 0])

    const arrayf = new Float32Array(memory.buffer, offset, 6)
    arrayf.set([2, 3, 4, 5, 6, 7.01])
    
    // Call the function and display the results.
    const result = julia_sum_matrix(BigInt(array.byteOffset))
      
    console.log(result);

    console.log(arrayf);

});
