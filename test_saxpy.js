// Assume add.wasm file exists that contains a single function adding 2 provided arguments
const fs = require('fs');

const wasmBuffer = fs.readFileSync('test_saxpy.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
  // Exported function live under instance.exports
  const { julia_sum_matrix, memory } = wasmModule.instance.exports;

    // Create an array that can be passed to the WebAssembly instance.
    const array = new Int32Array(memory.buffer, 0, 4)

    // data starts after 4 Int32
    offset = 4*4
    array.set([offset, 6, 2, 3])

    const arrayf = new Float32Array(memory.buffer, offset, 6)
    arrayf.set([2, 3, 4, 5, 6, 7.01])
    
    // Call the function and display the results.
    const result = julia_sum_matrix(array.byteOffset)
      
    console.log(result);

    console.log(arrayf);

});
