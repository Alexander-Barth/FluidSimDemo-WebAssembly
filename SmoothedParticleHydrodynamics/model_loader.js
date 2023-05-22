import { MallocArray, MallocArray2, pcolor, quiver, mouse_edit_mask, color } from "../julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_model_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const sz = [300,100];
    const dx = 5000;
    var ntime = 0;
    const nparticles = 1219
    //let scale = 0.2;
    let scale = 0.6;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [particles_p, particles] = MallocArray2(Float32Array,memory,base,[nparticles],8);

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
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let show_velocity = document.getElementById("show_velocity").checked;

        if (!isNaN(grav) && !isNaN(f) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(DeltaT) && (pmax > pmin)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            const start = performance.now();
            const result = julia_model_step(
                grav,f,dx,DeltaT,ntime,
                mask_p,particles_p);
            const end = performance.now();
            //console.log(`Execution time: ${end - start} ms. result ${result}`);

            ntime += 1;

            if ((ntime % 10) == 0) {
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

                    ctx.fillStyle = color(particles[partsize * i + iscalar],pmin,pmax);
                    ctx.beginPath();
                    ctx.arc(x, y, radius, 0, 2 * Math.PI);
                    ctx.fill();
                }

                if (show_velocity) {
                    //quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 500});

                }

            }
        }

        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
