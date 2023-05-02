import { MallocArray, pcolor, quiver } from "./julia_wasm_utils.js";

export async function run(document) {
    var mouse_button_down = false;


    const response = await fetch('test_fluid_sim.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_fluid_sim_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const sz = [300,100];
    const DeltaT = 1/60;
    const rho = 1000.;
    const overrelaxation = 1.9;
    const iter_pressure = 40;
    const u0 = 2.;
    const h = 0.01;
    var ntime = 0;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [pressure_p, pressure] = MallocArray(Float32Array,memory,base,sz);

    let [u_p, u] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [v_p, v] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    let [newu_p, newu] = MallocArray(Float32Array,memory,base,[sz[0]+1,sz[1]]);
    let [newv_p, newv] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]+1]);

    // pressure range
    let pmin = -4000;
    let pmax = 2000;
    // resolution for the plot
    let res = 2;
    // canvas for plotting
    let canvas = document.getElementById("plot");
    var ctx = canvas.getContext("2d");

    function handle_mouse(e) {
        var flags = e.buttons !== undefined ? e.buttons : e.which;
        mouse_button_down = (flags & 1) === 1;

        var rect = e.target.getBoundingClientRect();
        var x = e.clientX - rect.left; //x position within the element.
        var y = e.clientY - rect.top;  //y position within the element.

        if (!mouse_button_down) {
            return
        }
        let erase = document.getElementById("erase").checked;
        let pen_size = parseFloat(document.getElementById("pen_size").value);

        // do not change boundary walls
        for (let i=1; i < sz[0]; i++) {
            for (let j=1; j < sz[1]-1; j++) {
                let dx = (res*i - x);
                let dy = (res*j - y);
                if (dx*dx + dy*dy < pen_size*pen_size) {
                    let ij = i + sz[0] * j;
                    mask[i + sz[0] * j] = erase;
                }
            }
        }

    }

    canvas.addEventListener("mousedown", handle_mouse);
    canvas.addEventListener("mousemove", handle_mouse);
    canvas.addEventListener("mouseup", handle_mouse);

    function step(timestamp) {
        let u0 = parseFloat(document.getElementById("u0").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let iter_pressure = parseInt(document.getElementById("iter_pressure").value);
        let overrelaxation = parseFloat(document.getElementById("overrelaxation").value);
        let show_velocity = document.getElementById("show_velocity").checked;

        if (!isNaN(u0) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(iter_pressure) && !isNaN(iter_pressure)) {

            const result = julia_fluid_sim_step(u0,h,DeltaT,rho,overrelaxation,iter_pressure,ntime,
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

