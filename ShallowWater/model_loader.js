import { MallocArray, pcolor, quiver, Axis } from "../julia_wasm_utils.js";

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
    let dt = parseFloat(params.get("dt") || 100);
    let hmax = parseFloat(params.get("hmax") || 0.25);
    let hmin = parseFloat(params.get("hmin") || -0.25);
    let velocity_scale = parseFloat(params.get("velocity_scale") || 500);
    let velocity_subsample = parseInt(params.get("velocity_subsample") || 5);
    let velocity_show = params.get("velocity_show") == "true";
    let velocity_min = parseFloat(params.get("velocity_min") || 0);

    document.getElementById("colormap").value = colormap;
    document.getElementById("grav").value = grav;
    document.getElementById("f").value = f;
    document.getElementById("beta").value = beta;
    document.getElementById("dt").value = dt;
    document.getElementById("hmax").value = hmax;
    document.getElementById("hmin").value = hmin;
    document.getElementById("xmax").innerHTML = (imax * dx)/1000; // km
    document.getElementById("ymax").innerHTML = (jmax * dx)/1000; // km
    document.getElementById("zmax").innerHTML = bottom_depth; // m
    document.getElementById("velocity_show").checked = velocity_show;

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

    let colorbar_width = 100;
    let cb_padding = 20;
    let cb_width = 20;
    let cb_height = canvas.height - 2*cb_padding;

    let ax = new Axis(canvas,0,0,canvas.width-colorbar_width,canvas.height);
    ax.mouse_edit_mask(erase_elem,pen_size_elem,mask,sz);

    let cb_ax = new Axis(canvas,canvas.width-colorbar_width+10,cb_padding,cb_width,cb_height);

    function step(timestamp) {
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let beta = parseFloat(document.getElementById("beta").value);
        let dt = parseFloat(document.getElementById("dt").value);
        let hmin = parseFloat(document.getElementById("hmin").value);
        let hmax = parseFloat(document.getElementById("hmax").value);
        let velocity_show = document.getElementById("velocity_show").checked;
        let colormap = document.getElementById("colormap").value;

        if (!isNaN(grav) && !isNaN(f) && !isNaN(hmin) && !isNaN(hmax) && !isNaN(dt) && (hmin < hmax)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);
            const result = julia_fluid_sim_step(
                grav,bottom_depth,f,beta,dx,dt,ntime,
                mask_p,fCoriolis_p,h_p,hu_p,hv_p,pressure_p,u_p,v_p,newu_p,newv_p);
            //console.log("beta ",beta,fCoriolis[0]);

            ntime += 1;

            ax.clear()
            ax.clim = [hmin,hmax];

            ax.pcolor(sz,pressure,{
                cmap: colormap,
                mask: mask
            });

            if (velocity_show) {
                ax.quiver(sz,u,v,{
                    subsample: velocity_subsample,
                    scale: velocity_scale,
                    min: velocity_min,
                    mask: mask
                });

            }
            ax.colorbar(cb_ax);
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
