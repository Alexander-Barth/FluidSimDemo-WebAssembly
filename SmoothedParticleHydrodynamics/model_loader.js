import { MallocArray, pcolor, quiver, mouse_edit_mask } from "../julia_wasm_utils.js";

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
    let scale = 0.2;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
    let [particles_p, particles] = MallocArray(Float32Array,memory,base,[8,nparticles]);

    // canvas for plotting
    const canvas = document.getElementById("plot");
    const erase_elem = document.getElementById("erase");
    const pen_size_elem = document.getElementById("pen_size");
    const [ctx,res] = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);

    function step(timestamp) {
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let show_velocity = document.getElementById("show_velocity").checked;

        if (!isNaN(grav) && !isNaN(f) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(DeltaT)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            const result = julia_model_step(
                grav,f,dx,DeltaT,ntime,
                mask_p,particles_p);

            ntime += 1;

            if ((ntime % 10) == 0) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                //pcolor(ctx,sz,res,pressure,mask,{pmin: pmin, pmax: pmax});
                console.log(ntime,particles[8*3 ]);
/*
                for (let i = 0; i < nparticles; i++) {
                    ctx.beginPath();
                    let x = scale * particles[8 * i + 0];
                    let y = scale * particles[8 * i + 1];
                    let radius = 2;
                    ctx.arc(x, y, radius, 0, 2 * Math.PI);
                    ctx.stroke();
                }

                if (show_velocity) {
                    //quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 500});

                }
*/
            }
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
}
