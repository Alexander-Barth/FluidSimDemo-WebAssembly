// Assume add.wasm file exists that contains a single function adding 2 provided arguments
const fs = require('fs');

const wasmBuffer = fs.readFileSync('test_matrix_lapack.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
  // Exported function live under instance.exports
    const { julia_sum_matrix, memory, __heap_base } = wasmModule.instance.exports;

    let offset = 0; //__heap_base.value;
    
    // Create an array that can be passed to the WebAssembly instance.
    
    const Ametadata = new Int32Array(memory.buffer, offset, 4)
    offset += Ametadata.byteLength;
    Ametadata.set([offset, 4, 2, 2])
    const Adata = new Float32Array(memory.buffer, offset, 4)
    Adata.set([10, 3, 1, 5.1])
    offset += Adata.byteLength;

    const Bmetadata = new Int32Array(memory.buffer, offset, 4)
    offset += Bmetadata.byteLength;
    Bmetadata.set([offset, 4, 2, 2])
    const Bdata = new Float32Array(memory.buffer, offset, 4)
    Bdata.set([2, 0.1, 2, 0])
    offset += Bdata.byteLength;

    const Cmetadata = new Int32Array(memory.buffer, offset, 4)
    offset += Cmetadata.byteLength;
    Cmetadata.set([offset, 4, 2, 2])
    const Cdata = new Float32Array(memory.buffer, offset, 4)
    Cdata.set([2, 3, 4, 5.1])
    offset += Cdata.byteLength;

    // Call the function and display the results.
    const result = julia_sum_matrix(
        Ametadata.byteOffset,
        Bmetadata.byteOffset,
        Cmetadata.byteOffset,
    )

    
//    console.log("aaa",__heap_base,wasmModule.instance.exports.__heap_base.value);
    console.log("aaa2",__heap_base.value);
    console.log(result);

    /* Float32Array(4) [ 11, 3, 19, 5.099999904632568 ]  */
    console.log(Bdata);

});
