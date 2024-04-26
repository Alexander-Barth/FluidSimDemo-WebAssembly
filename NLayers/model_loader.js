import { MallocArray, pcolor, quiver, mouse_edit_mask, colormaps, color } from "../julia_wasm_utils.js";



let params = new URLSearchParams(document.location.search);
const bottom_depth = parseFloat(params.get("bottom_depth") || 100); // m
const canvas_height_m = parseFloat(params.get("canvas_height_m") || 125); // m

const density_min = parseFloat(params.get("density_min") || 1015); // kg/m³
const density_max = parseFloat(params.get("density_max") || 1035); // kg/m³
let restart = true;

export async function run(document) {

    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes,{});

    const { julia_nlayer_step, julia_nlayer_init, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    let params = new URLSearchParams(document.location.search);
    const imax = parseInt(params.get("imax") || 101);
    const m = parseInt(params.get("m") || 8);
    const dx = parseFloat(params.get("dx") || 1000);
    const dt = parseFloat(params.get("dt") || 28.73);
    const grav = parseFloat(params.get("grav") || 9.81);
    const modeindex = parseInt(params.get("modeindex") || 1);
    const nplot = parseInt(params.get("nplot") || 1);
    const pert_amplitude = parseFloat(params.get("pert_amplitude") || (40/Math.sqrt(m)));
    const pert_width = parseFloat(params.get("pert_width") || (20*dx));
    const hmin = parseFloat(params.get("hmin") || 0.4 * bottom_depth/m);
    const hmax = parseFloat(params.get("hmax") || 1.5 * bottom_depth/m);
    const colormap = params.get("colormap") || "turbo";

    document.getElementById("modeindex").value = modeindex;
    document.getElementById("grav").value = grav;
    document.getElementById("dt").value = dt;
    document.getElementById("nplot").value = nplot;
    document.getElementById("colormap").value = colormap;

    let ntime = 0;

    // n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom
    let [rho_p, rho] = MallocArray(Float32Array,memory,base,[m]);
    let [z0_p, z0] = MallocArray(Float32Array,memory,base,[m]);

    let [P_p, P] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [h_p, h] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [hm_p, hm] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [hu_p, hu] = MallocArray(Float32Array,memory,base,[imax+1,m]);
    let [u_p, u] = MallocArray(Float32Array,memory,base,[imax+1,m]);
    let [z_p, z] = MallocArray(Float32Array,memory,base,[imax,m+1]);
    let [bottom_p, bottom] = MallocArray(Float32Array,memory,base,[imax]);

    let [eigenvalues_p, eigenvalues] = MallocArray(Float32Array,memory,base,[m]);
    let [eigenvectors_p, eigenvectors] = MallocArray(Float32Array,memory,base,[m,m]);
    let [work1_p, work1] = MallocArray(Float32Array,memory,base,[m,m]);
    let [work2_p, work2] = MallocArray(Float32Array,memory,base,[m,m]);
    let [potential_matrix_p, potential_matrix] = MallocArray(Float32Array,memory,base,[m,m]);


    /*
    rho[0] = 1020;
    rho[1] = 1035;
    rho[2] = 1050;
    rho[3] = 1065;
    rho[4] = 1080;
    */

    for (let i = 0; i < imax; i++) {
        bottom[i] = bottom_depth;
        for (let k = 0; k < m; k++) {
            hm[i + k*imax] = bottom[i]/m;
        }
    }

    let rho_min = 1020;
    let rho_max = 1030;
    for (let k = 0; k < m; k++) {
        if (m > 1) {
            rho[k] = rho_min + k * (rho_max-rho_min)/(m-1);
        }
        else {
            rho[k] = (rho_max+rho_min)/2
        }
        z0[k] = (k + 0.5) * bottom_depth/m;
    }
    // canvas for plotting
    const canvas = document.getElementById("plot");
    let svg = document.getElementById("profile");

    document.getElementById("modeindex").max = m;
    // rho[1] is the surface layers
    let axis_density = {
        figure: svg,
        elem: svg.getElementById("density"),
        min: density_min,
        max: density_max
    }

    let axis_mode = {
        figure: svg,
        elem: svg.getElementById("mode"),
        min: -2,
        max: 2
    }

    setProfile(axis_density,z0,rho,{color: "#007bff", markersize: 5});
    makeDraggable(svg,axis_density);
    drawlines(axis_density);

    document.getElementById("modeindex").onchange = function() {
        ntime = 0;
    }

    let ctx = canvas.getContext("2d");
    ctx.transform(1, 0, 0, -1, 0, canvas.height)

    function step(timestamp) {
        let modeindex = parseInt(document.getElementById("modeindex").value);
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let dt = parseFloat(document.getElementById("dt").value);
        let velocity_show = document.getElementById("velocity_show").checked;
        let nplot = parseInt(document.getElementById("nplot").value);
        let colormap = document.getElementById("colormap").value;


        let [profile_z,profile_density] = getProfile(axis_density);

        for (let k = 0; k < m; k++) {
            rho[k] = profile_density[k];
        }


        if (!isNaN(grav) && !isNaN(f) && !isNaN(dt)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            //let modeindex = 3;

            if (ntime == 0 || restart) {
                julia_nlayer_init(
                    dx,modeindex,
                    pert_amplitude, pert_width,
                    rho_p,hm_p,h_p,u_p,
                    eigenvalues_p,eigenvectors_p,potential_matrix_p,work1_p,work2_p);

                if (modeindex != 0) {
                    let mode = Array(m);
                    for (let k = 0; k < m; k++) {
                        mode[k] = eigenvectors[k + m*(modeindex-1)];
                    }
                    //console.log(profile_density);
                    //console.log("mode ",mode);

                    setProfile(axis_mode,z0,mode,{color: "#d97c26", markersize: 0});
                    drawlines(axis_mode,{color: "#d97c26"});
                }

                restart = false;
            }

            let startTime =  performance.now();
            for (let iplot = 0; iplot < nplot; iplot++) {
                const result = julia_nlayer_step(
                    ntime,dx,dt,grav,
                    rho_p,P_p,h_p,hm_p,hu_p,u_p,z_p,bottom_p
                );
                ntime += 1;
            }
            let endTime = performance.now()
            //console.log("time delta", endTime - startTime);


            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let cmap = colormaps[colormap];
            let scalex = canvas.width/(imax-1);
            let scaley = canvas.height/canvas_height_m;

            for (let k = 0; k < m; k++) {

                for (let i = 0; i < imax-1; i++) {
                    ctx.fillStyle = color(h[i + k*imax],hmin,hmax,{cmap: cmap});

                    //ctx.fillStyle = '#f00';
                    ctx.beginPath();
                    ctx.moveTo(scalex*i, scaley*z[i + k*imax]);
                    ctx.lineTo(scalex*(i+1), scaley*z[i+1 + k*imax]);
                    ctx.lineTo(scalex*(i+1), scaley*z[i+1 + (k+1)*imax]);
                    ctx.lineTo(scalex*i, scaley*z[i + (k+1)*imax]);
                    ctx.closePath();
                    ctx.fill();
                }
            }

            for (let k = 0; k < m; k++) {
                ctx.beginPath();
                ctx.moveTo(0,scaley*z[k*imax]);

                for (let i = 0; i < imax; i++) {
                    ctx.lineTo(scalex*i, scaley*z[i + k*imax]);
                }
                ctx.stroke();
            }

            //console.log("z ",h[0]);
        }
        window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
}

function setProfile(axis,z,density,{color = "#007bff", markersize = 5} = {}) {
    let svg = axis.figure;
    let factor = (axis.max - axis.min) / svg.width.baseVal.value;
    let H = svg.height.baseVal.value;
    let markers = axis.elem.getElementsByClassName("markers")[0];
    let svgNS = "http://www.w3.org/2000/svg";

    markers.innerHTML = "";


    for (let i = 0; i < z.length; i++) {
        let cx = (density[i] - axis.min) / factor;
        //let cy = 3*z[i];
        let cy = H - (bottom_depth - z[i]) * H / canvas_height_m;

        //drags[i].setAttributeNS(null, "cx", cx);
        //drags[i].setAttributeNS(null, "cy", cy);

        let drag = document.createElementNS(svgNS,"circle");
        drag.setAttributeNS(null, "cx", cx);
        drag.setAttributeNS(null, "cy", cy);
        drag.setAttributeNS(null, "r", markersize);
        drag.setAttributeNS(null, "fill", color);
        drag.setAttributeNS(null, "class", "draggable");
        markers.appendChild(drag);
    }
}

function getProfile(axis) {
    let svg = axis.figure;
    let drags = axis.elem.getElementsByClassName("markers")[0].children;

    let z = [];
    let density = [];

    let factor = (axis.max - axis.min) / axis.figure.width.baseVal.value;

    for (let i = 0; i < drags.length; i++) {
        z.push(parseFloat(drags[i].getAttribute("cy")));
        density.push(axis.min + parseFloat(drags[i].getAttribute("cx")) * factor);
    }

    return [z,density];
}


function drawlines(axis,{color = "rgb(190,190,255)"} = {}) {
    let svg = axis.figure;
    let ll = axis.elem.getElementsByClassName("lines")[0];

    while (ll.hasChildNodes()) {
        ll.removeChild(ll.firstChild);
    }

    let drags = axis.elem.getElementsByClassName("markers")[0].children;

    //console.log("drags",drags[0].getAttribute("cx"),drags[0].getAttribute("cx"));
    let svgNS = "http://www.w3.org/2000/svg";

    for (let i = 0; i < drags.length-1; i++) {
        let ll0 = document.createElementNS(svgNS,"line");
        ll0.setAttributeNS(null,"x1",drags[i].getAttribute("cx"));
        ll0.setAttributeNS(null,"y1",drags[i].getAttribute("cy"));
        ll0.setAttributeNS(null,"x2",drags[i+1].getAttribute("cx"));
        ll0.setAttributeNS(null,"y2",drags[i+1].getAttribute("cy"));
        ll0.setAttributeNS(null,"style","stroke:" + color + ";stroke-width:2")
        ll.appendChild(ll0);
    }
}

//
function makeDraggable(svg,axis_density) {
    svg.addEventListener('mousedown', startDrag);
    svg.addEventListener('mousemove', drag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
    svg.addEventListener('touchstart', startDrag);
    svg.addEventListener('touchmove', drag);
    svg.addEventListener('touchend', endDrag);
    svg.addEventListener('touchleave', endDrag);
    svg.addEventListener('touchcancel', endDrag);

    drawlines(axis_density);
    let selectedElement, offset, transform,
        bbox, minX, maxX, minY, maxY, confined;

    let boundaryX1 = 10.5;
    let boundaryX2 = 30;
    let boundaryY1 = 2.2;
    let boundaryY2 = 19.2;

    function getMousePosition(evt) {
        let CTM = svg.getScreenCTM();
        if (evt.touches) { evt = evt.touches[0]; }
        return {
            x: (evt.clientX - CTM.e) / CTM.a,
            y: (evt.clientY - CTM.f) / CTM.d
        };
    }

    function startDrag(evt) {
        if (evt.target.classList.contains('draggable')) {

            selectedElement = evt.target;
            offset = getMousePosition(evt);
            offset.x -= parseFloat(selectedElement.getAttributeNS(null, "cx"));
            offset.y -= parseFloat(selectedElement.getAttributeNS(null, "cy"));
/*
            selectedElement = evt.target;
            offset = getMousePosition(evt);

            // Make sure the first transform on the element is a translate transform
            let transforms = selectedElement.transform.baseVal;

            if (transforms.length === 0 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
                // Create an transform that translates by (0, 0)
                let translate = svg.createSVGTransform();
                translate.setTranslate(0, 0);
                selectedElement.transform.baseVal.insertItemBefore(translate, 0);
            }

            // Get initial translation
            transform = transforms.getItem(0);
            offset.x -= transform.matrix.e;
            offset.y -= transform.matrix.f;

            confined = evt.target.classList.contains('confine');
            if (confined) {
                bbox = selectedElement.getBBox();
                minX = boundaryX1 - bbox.x;
                maxX = boundaryX2 - bbox.x - bbox.width;
                minY = boundaryY1 - bbox.y;
                maxY = boundaryY2 - bbox.y - bbox.height;
            }
*/
        }
    }

    function drag(evt) {
        if (selectedElement) {
            evt.preventDefault();


            let coord = getMousePosition(evt);

            // constrait position
            // density must to monotonic
            let prev, next;

            let cx = coord.x - offset.x;

            prev = selectedElement.previousElementSibling;
            if (prev) {
                cx = Math.max(cx,parseFloat(prev.getAttributeNS(null, "cx")));
            }

            next = selectedElement.nextElementSibling;
            if (next) {
                cx = Math.min(cx,parseFloat(next.getAttributeNS(null, "cx")));
            }

            selectedElement.setAttributeNS(null, "cx", Math.max(cx,0));

            drawlines(axis_density);
            restart = true;
        }


    }



    function endDrag(evt) {
        //console.log("foo");
        drawlines(axis_density);
        selectedElement = false;
    }
}
