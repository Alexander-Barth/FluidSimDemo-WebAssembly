import { MallocArray, pcolor, quiver, mouse_edit_mask, Axis } from "./julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('test_fluid_sim.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_fluid_sim_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    let params = new URLSearchParams(document.location.search);
    const imax = parseInt(params.get("imax") || 300);
    const jmax = parseInt(params.get("jmax") || 100);
    let colormap = params.get("colormap") || "turbo";
    let u0 = parseFloat(params.get("u0") || 2);
    let iter_pressure = parseInt(params.get("iter_pressure") || 40);
    let overrelaxation = parseFloat(params.get("overrelaxation") || 1.9);
    let dt = parseFloat(params.get("dt") || 0.015);
    let dx = parseFloat(params.get("dx") || 0.01);
    let rho = parseFloat(params.get("rho") || 1000);
    let pmin = parseFloat(params.get("pmin") || -4000);
    let pmax = parseFloat(params.get("pmax") || 2000);
    let velocity_show = (params.get("pmax") || "false") == "true"

    document.getElementById("u0").value = u0;
    document.getElementById("dt").value = dt;
    document.getElementById("iter_pressure").value = iter_pressure;
    document.getElementById("overrelaxation").value = overrelaxation;
    document.getElementById("colormap").value = colormap;
    document.getElementById("pmin").value = pmin;
    document.getElementById("pmax").value = pmax;
    document.getElementById("velocity_show").checked = velocity_show;

    const sz = [imax,jmax];
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
    const ctx = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);



    let colorbar_width = 100;
    let cb_padding = 20;
    let cb_width = 20;
    let cb_height = canvas.height - 2*cb_padding;
    const cb_pressure = new Float32Array(cb_height);
    let ax = new Axis(ctx,0,0,canvas.width-colorbar_width,canvas.height);
    let cb_ax = new Axis(ctx,canvas.width-colorbar_width+10,cb_padding,cb_width,cb_height);

    function step(timestamp) {
        let u0 = parseFloat(document.getElementById("u0").value);
        let dt = parseFloat(document.getElementById("dt").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let iter_pressure = parseInt(document.getElementById("iter_pressure").value);
        let overrelaxation = parseFloat(document.getElementById("overrelaxation").value);
        let velocity_show = document.getElementById("velocity_show").checked;
        let colormap = document.getElementById("colormap").value;

        if (!isNaN(u0) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(iter_pressure) && !isNaN(iter_pressure)) {

            const result = julia_fluid_sim_step(u0,dx,dt,rho,overrelaxation,iter_pressure,ntime,
                                                mask_p,pressure_p,u_p,v_p,newu_p,newv_p);

            ntime += 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            ax.clim = [pmin,pmax];
            ax.pcolor(sz,pressure,{cmap: colormap, mask: mask});

            if (velocity_show) {
                ax.quiver(sz,u,v,{
                    subsample: 5,
                    scale: 2.5,
                    mask: mask});
            }

            ax.colorbar(cb_ax);

        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
