import { MallocArray, pcolor, quiver, mouse_edit_mask } from "../julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_fluid_sim_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    let params = new URLSearchParams(document.location.search);
    const imax = parseInt(params.get("imax") || 300);
    const jmax = parseInt(params.get("jmax") || 100);
    const colormap = params.get("colormap") || "turbo";
    const dx = parseFloat(params.get("dx") || 5000); // m
    const bottom_depth = parseFloat(params.get("bottom_depth") || 100); // m
    let grav = parseFloat(params.get("grav") || 9.81);
    let beta = parseFloat(params.get("beta") || 0);
    let f = parseFloat(params.get("f") || 0);
    let DeltaT = parseFloat(params.get("DeltaT") || 100);
    let hmax = parseFloat(params.get("hmax") || 0.25);
    let hmin = parseFloat(params.get("hmin") || -0.25);

    document.getElementById("colormap").value = colormap;
    document.getElementById("grav").value = grav;
    document.getElementById("f").value = f;
    document.getElementById("beta").value = beta;
    document.getElementById("DeltaT").value = DeltaT;
    document.getElementById("hmax").value = hmax;
    document.getElementById("hmin").value = hmin;
    document.getElementById("xmax").innerHTML = (imax * dx)/1000; // km
    document.getElementById("ymax").innerHTML = (jmax * dx)/1000; // km
    document.getElementById("zmax").innerHTML = bottom_depth; // m

    const sz = [imax,jmax];
    var ntime = 0;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [fCoriolis_p, fCoriolis] = MallocArray(Float32Array,memory,base,sz);

    let [pressure_p, pressure] = MallocArray(Float32Array,memory,base,sz);

    let [u_p, u] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [v_p, v] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    let [h_p, h] = MallocArray(Float32Array,memory,base,sz);
    let [hu_p, hu] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [hv_p, hv] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    let [newu_p, newu] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [newv_p, newv] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    // canvas for plotting
    const canvas = document.getElementById("plot");
    const erase_elem = document.getElementById("erase");
    const pen_size_elem = document.getElementById("pen_size");
    const [ctx,res] = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);

    function step(timestamp) {
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let beta = parseFloat(document.getElementById("beta").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let hmin = parseFloat(document.getElementById("hmin").value);
        let hmax = parseFloat(document.getElementById("hmax").value);
        let show_velocity = document.getElementById("show_velocity").checked;
        let colormap = document.getElementById("colormap").value;

        if (!isNaN(grav) && !isNaN(f) && !isNaN(hmin) && !isNaN(hmax) && !isNaN(DeltaT)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);
            const result = julia_fluid_sim_step(
                grav,bottom_depth,f,beta,dx,DeltaT,ntime,
                mask_p,fCoriolis_p,h_p,hu_p,hv_p,pressure_p,u_p,v_p,newu_p,newv_p);
            //console.log("beta ",beta,fCoriolis[0]);

            ntime += 1;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pcolor(ctx,sz,res,pressure,mask,{pmin: hmin, pmax: hmax, cmap: colormap});

            if (show_velocity) {
                quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 500});

            }
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
