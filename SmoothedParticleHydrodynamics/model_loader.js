import { MallocArray, MallocArray2, pcolor, quiver, mouse_edit_mask, color, colormaps } from "../julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_model_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    let params = new URLSearchParams(document.location.search);
    const imax = parseInt(params.get("imax") || 300);
    const jmax = parseInt(params.get("jmax") || 100);
    const dx = parseFloat(params.get("dx") || 5000);
    const colormap = params.get("colormap") || "turbo";
    const nparticles = parseInt(params.get("nparticles") || 1219);
    const scale = parseFloat(params.get("scale") || 0.6);
    const grav = parseFloat(params.get("grav") || 9.81);
    const dt = parseFloat(params.get("dt") || 0.0007);
    const nplot = parseInt(params.get("nplot") || 1);
    const pmin = parseFloat(params.get("pmin") || -600000);
    const pmax = parseFloat(params.get("pmax") || -599196);

    document.getElementById("colormap").value = colormap;
    document.getElementById("grav").value = grav;
    document.getElementById("dt").value = dt;
    document.getElementById("pmin").value = pmin;
    document.getElementById("pmax").value = pmax;

    const sz = [imax,jmax];
    var ntime = 0;

    const sz_table = [76,57];

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [particles_p, particles] = MallocArray2(Float32Array,memory,base,[nparticles],8);
    let [table_p, table] = MallocArray(Int32Array,memory,base,[sz_table[0] * sz_table[1] + 1]);
    let [num_particles_p, num_particles] = MallocArray(Int32Array,memory,base,[nparticles]);
    let [visited_p, visited] = MallocArray(Int32Array,memory,base,[nparticles]);


    // canvas for plotting
    const canvas = document.getElementById("plot");
    const erase_elem = document.getElementById("erase");
    const pen_size_elem = document.getElementById("pen_size");
    const [ctx,res] = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);

    const ipressure = 7;
    const idensity = 6;
    const ix = 0;
    const iy = 1;
    const partsize = 8;

    const iscalar = ipressure;
    //const iscalar = idensity;

    function step(timestamp) {
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let dt = parseFloat(document.getElementById("dt").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let velocity_show = document.getElementById("velocity_show").checked;
        let colormap = document.getElementById("colormap").value;


        let cmap = colormaps[colormap];

        if (!isNaN(grav) && !isNaN(f) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(dt) && (pmax > pmin)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            const start = performance.now();

            for (let iplot = 0; iplot < nplot; iplot++) {
                const result = julia_model_step(
                    grav,f,dx,dt,ntime,sz_table[0],sz_table[1],
                    mask_p,particles_p,
                    table_p,
                    num_particles_p,
                    visited_p
                );

                ntime += 1;
            }

            const end = performance.now();
            //console.log(`Execution time: ${end - start} ms. result ${result}`);


            ctx.clearRect(0, 0, canvas.width, canvas.height);

            let pminc = +Infinity;
            let pmaxc = -Infinity;
            for (let i = 0; i < nparticles; i++) {
                let p = particles[partsize * i + iscalar];
                if (p > pmaxc) pmaxc = p;
                if (p < pminc) pminc = p;
            }

            console.log("pmax",pmaxc,pminc);

            for (let i = 0; i < nparticles; i++) {
                let x = scale * particles[partsize * i + ix];
                let y = scale * particles[partsize * i + iy];
                let radius = 2;

                ctx.fillStyle = color(particles[partsize * i + iscalar],pmin,pmax,{cmap: cmap});
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.fill();
            }

            if (velocity_show) {
                //quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 500});
            }
        }

        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
