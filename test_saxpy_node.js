// Assume add.wasm file exists that contains a single function adding 2 provided arguments
const fs = require('fs');

const wasmBuffer = fs.readFileSync('test_saxpy.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
  // Exported function live under instance.exports
    const { julia_saxpy, memory, __heap_base } = wasmModule.instance.exports;

    let offset = 0; //__heap_base.value;
    
    // Create an array that can be passed to the WebAssembly instance.
    
    const Ametadata = new Int32Array(memory.buffer, offset, 4)
    offset += Ametadata.byteLength;
    Ametadata.set([offset, 4, 4])
    const Adata = new Float32Array(memory.buffer, offset, 4)
    Adata.set([10, 3, 1, 5.1])
    offset += Adata.byteLength;

    const Bmetadata = new Int32Array(memory.buffer, offset, 4)
    offset += Bmetadata.byteLength;
    Bmetadata.set([offset, 4, 4])
    const Bdata = new Float32Array(memory.buffer, offset, 4)
    Bdata.set([2, 0.1, 2, 0])
    offset += Bdata.byteLength;


    // Call the function and display the results.
    const result = julia_saxpy(
        10,
        Ametadata.byteOffset,
        Bmetadata.byteOffset,
    )
    
    console.log(result);
    console.log(Bdata);

});
