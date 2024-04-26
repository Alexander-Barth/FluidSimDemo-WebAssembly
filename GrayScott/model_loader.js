import { MallocArray, pcolor, quiver, mouse_edit_mask } from "../julia_wasm_utils.js";

export async function run(document) {
    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_model_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    let params = new URLSearchParams(document.location.search);
    const imax = parseInt(params.get("imax") || 256);
    const jmax = parseInt(params.get("jmax") || 256);
    const dx = parseFloat(params.get("dx") || 1);
    const colormap = params.get("colormap") || "turbo";

    document.getElementById("colormap").value = colormap;

    const sz = [imax,jmax];
    const r = 20;
    var ntime = 0;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);

    // all valid points
    for (let i=0; i < sz[0]; i++) {
        for (let j=0; j < sz[1]; j++) {
            let ij = i + sz[0] * j;
            mask[ij] = 1;
        }
    }

    let [u_p, u] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]]);
    let [v_p, v] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]]);

    let [un_p, un] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]]);
    let [vn_p, vn] = MallocArray(Float32Array,memory,base,[sz[0],sz[1]]);

    // canvas for plotting
    const canvas = document.getElementById("plot");
    const erase_elem = document.getElementById("erase");
    const pen_size_elem = document.getElementById("pen_size");
    const coefficients = document.getElementById("coefficients");
    const [ctx,res] = mouse_edit_mask(canvas,erase_elem,pen_size_elem,mask,sz);

    function step(timestamp) {
        let Du = parseFloat(document.getElementById("Du").value);
        let Dv = parseFloat(document.getElementById("Dv").value);
        let f = parseFloat(document.getElementById("f").value);
        let k = parseFloat(document.getElementById("k").value);
        let dt = parseFloat(document.getElementById("dt").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let nplot = 20;
        let colormap = document.getElementById("colormap").value;

        if (!isNaN(Du) && !isNaN(Dv) && !isNaN(f) && !isNaN(k) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(dt)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);


            for (let iplot = 0; iplot < nplot; iplot++) {
                const result = julia_model_step(
                    dx,dt,Du,Dv,f,k,r,ntime,mask_p,u_p,v_p,un_p,vn_p);

                ntime += 1;
            }

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pcolor(ctx,sz,res,u,mask,{pmin: pmin, pmax: pmax, cmap: colormap});
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);

    coefficients.addEventListener("change", (event) => {
        console.log(event);
        let option = event.target.selectedOptions[0].value;
        if (option != "custom") {
            let [Du, Dv, f, k] = option.split(",").map(parseFloat);

            document.getElementById("Du").value = Du;
            document.getElementById("Dv").value = Dv;
            document.getElementById("f").value = f;
            document.getElementById("k").value = k;
        }
    });

}
