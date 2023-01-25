const fs = require('fs');

const wasmBuffer = fs.readFileSync('test_add.wasm');
WebAssembly.instantiate(wasmBuffer).then(wasmModule => {
    // Exported function live under instance.exports
    const { julia_add, memory } = wasmModule.instance.exports;

    // Call the function and display the results.
    const result = julia_add(2,3)
    console.log(result);
});
