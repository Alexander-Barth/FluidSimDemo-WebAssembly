



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


export async function init() {
    const response = await fetch('test_julia.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_sum_matrix, memory } = instance.exports;


    // base[0] offset of memory, increased by MallocArray
    let base = [0];

    //const sz = [300,10];
    const sz = [300,100];
    const DeltaT = 1/60;
    const rho = 1000.;
    const overrelaxation = 1.9
    const iter_pressure = 40
    const u0 = 2.
        const h = 0.01
    
    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [pressure_p, pressure] = MallocArray(Float32Array,memory,base,sz);
    
    let [u_p, u] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [v_p, v] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    let [newu_p, newu] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [newv_p, newv] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);
    
    


    let i,j,x=[],y=[],z=[];

    for (i=0; i < sz[0]; i++) {
        x[i] = [];
        y[i] = [];
        z[i] = [];

        for (j=0; j < sz[1]; j++) {
            x[i][j] = i;
            y[i][j] = j;
            z[i][j] = 0;
        }
    }

    let fig = new matplot.Figure("plot",920,300, {renderer: matplot.RasterCanvas});
    let ax = fig.axes();
    //let fig = new matplot.Figure("plot",920,300);
    function step(timestamp) {
        //fig.clear();
        const result = julia_sum_matrix(u0,h,DeltaT,rho,overrelaxation,iter_pressure,
                                    mask_p,pressure_p,u_p,v_p,newu_p,newv_p);
        
        for (i=0; i < sz[0]; i++) {
            for (j=0; j < sz[1]; j++) {
                let ij = i + sz[0] * j;
                if (mask[ij] == 1) {
                    z[i][j] = pressure[ij];
                }
                else {
                    z[i][j] = NaN;
                }                
            }
        }
    
    
        console.log("result ",result);
        //console.log(pressure[1 + sz[1] * 1]);
        //console.log(data2);

        ax.pcolor(x,y,z);
        ax.cLim([1000,12000]);
        //ax.colorbar();
        fig.draw();
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
