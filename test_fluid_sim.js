import { MallocArray, pcolor, quiver, mouse_edit_mask } from "./julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('test_fluid_sim.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_fluid_sim_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const sz = [300,100];
    const rho = 1000.;
    const dx = 0.01;
    var ntime = 0;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [pressure_p, pressure] = MallocArray(Float32Array,memory,base,sz);

    let [u_p, u] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [v_p, v] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    let [newu_p, newu] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [newv_p, newv] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    // canvas for plotting
    const canvas = document.getElementById("plot");
    const erase_elem = document.getElementById("erase");
    const pen_size_elem = document.getElementById("pen_size");
    const [ctx,res] = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);

    function step(timestamp) {
        let u0 = parseFloat(document.getElementById("u0").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let iter_pressure = parseInt(document.getElementById("iter_pressure").value);
        let overrelaxation = parseFloat(document.getElementById("overrelaxation").value);
        let show_velocity = document.getElementById("show_velocity").checked;

        if (!isNaN(u0) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(iter_pressure) && !isNaN(iter_pressure)) {

            const result = julia_fluid_sim_step(u0,dx,DeltaT,rho,overrelaxation,iter_pressure,ntime,
                                                mask_p,pressure_p,u_p,v_p,newu_p,newv_p);

            ntime += 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pcolor(ctx,sz,res,pressure,mask,{pmin: pmin, pmax: pmax});

            if (show_velocity) {
                quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 2.5});

            }
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
