



export function MallocArray(typearray,memory,base,size) {
    // number of elements in array
    let len = size.reduce((a, b)=> a*b, 1);

    // pointer (Int32), length (Int32), size1 (Int32), size2, ...
    // where
    // length = size1*size2*...
    let metadata = new Int32Array(memory.buffer, base[0], 2 + size.length);
    base[0] += metadata.byteLength;
    metadata.set([base[0], len].concat(size));

    //console.log("metadata ",metadata);
    
    const data = new typearray(memory.buffer, base[0], len);
    base[0] += data.byteLength;

    return [metadata.byteOffset, data];
}



export function sayHi(user) {
  alert(`Hello, ${user}!`);
}
