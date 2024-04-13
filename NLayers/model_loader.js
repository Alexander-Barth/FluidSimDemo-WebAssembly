import { MallocArray, pcolor, quiver, mouse_edit_mask, clamp, turbo_colormap, rgb } from "../julia_wasm_utils.js";

const bottom_depth = 100; // m
const canvas_height_m = 125; // m

const density_min = 1000;
const density_max = 1100;

export async function run(document) {
    makeDraggable(document.getElementById("profile"));

    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes,{});

    const { julia_nlayer_step, julia_nlayer_init, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const imax = 101;
    const m = 10;
    const dx = 1000;
    const dt = 28.73;
    const grav = 9.81;

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
    let rho_max = 1080;
    for (let k = 0; k < m; k++) {
        rho[k] = rho_min + k * (rho_max-rho_min)/(m-1);
        z0[k] = (k + 0.5) * bottom_depth/m;
    }
    // canvas for plotting
    const canvas = document.getElementById("plot");
    let svg = document.getElementById("profile");
    let cmap = turbo_colormap;

    document.getElementById("modeindex").max = m;
    // rho[1] is the surface layers
    setProfile(svg,z0,rho);
    drawlines(svg);

    document.getElementById("modeindex").onchange = function() {
        ntime = 0;
    }

    let ctx = canvas.getContext("2d");
    ctx.transform(1, 0, 0, -1, 0, canvas.height)

    function step(timestamp) {
        let modeindex = parseInt(document.getElementById("modeindex").value);
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let show_velocity = document.getElementById("show_velocity").checked;
        let nplot = parseInt(document.getElementById("nplot").value);
        let [profile_z,profile_density] = getProfile(svg);


        //console.log(profile_density);

        for (let k = 0; k < m; k++) {
            rho[k] = profile_density[k];
        }


        if (!isNaN(grav) && !isNaN(f) && !isNaN(DeltaT)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            //let modeindex = 3;

            if (ntime == 0) {
                julia_nlayer_init(
                    dx,modeindex,
                    rho_p,hm_p,h_p,u_p,
                    eigenvalues_p,eigenvectors_p,potential_matrix_p,work1_p,work2_p);
            }

            let startTime =  performance.now();
            for (let iii = 0; iii < nplot; iii++) {
                const result = julia_nlayer_step(
                    ntime,dx,DeltaT,grav,
                    rho_p,P_p,h_p,hm_p,hu_p,u_p,z_p,bottom_p
                );
                ntime += 1;
            }
            let endTime = performance.now()
            //console.log("time delta", endTime - startTime);


            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let scalex = canvas.width/(imax-1);
            let scaley = canvas.height/canvas_height_m;
            let pmin = 0.4 * bottom_depth/m;
            let pmax = 1.5 * bottom_depth/m;

            for (let k = 0; k < m; k++) {

                for (let i = 0; i < imax-1; i++) {
                    let pp = h[i + k*imax];
                    let ind = Math.floor(255 * clamp((pp - pmin) / (pmax-pmin),0,1));
                    let color = cmap[ind];
                    ctx.fillStyle = rgb(255*color[0],255*color[1],255*color[2]);

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

function setProfile(svg,z,density) {
    let factor = (density_max - density_min) / document.getElementById("profile").width.baseVal.value;
    let H = document.getElementById("profile").height.baseVal.value;
    let markers = document.getElementById("markers");
    let svgNS = "http://www.w3.org/2000/svg";

    markers.innerHTML = "";


    //let drags = svg.getElementsByClassName("draggable");

    for (let i = 0; i < z.length; i++) {
        let cx = (density[i] - density_min) / factor;
        //let cy = 3*z[i];
        let cy = H - (bottom_depth - z[i]) * H / canvas_height_m;

        //drags[i].setAttributeNS(null, "cx", cx);
        //drags[i].setAttributeNS(null, "cy", cy);

        let drag = document.createElementNS(svgNS,"circle");
        drag.setAttributeNS(null, "cx", cx);
        drag.setAttributeNS(null, "cy", cy);
        drag.setAttributeNS(null, "r", 5);
        drag.setAttributeNS(null, "fill", "#007bff");
        drag.setAttributeNS(null, "class", "draggable");
        markers.appendChild(drag);
    }
}

function getProfile(svg) {
    let drags = svg.getElementsByClassName("draggable");

    let z = [];
    let density = [];

    let factor = (density_max - density_min) / document.getElementById("profile").width.baseVal.value;

    for (let i = 0; i < drags.length; i++) {
        z.push(parseFloat(drags[i].getAttribute("cy")));
        density.push(density_min + parseFloat(drags[i].getAttribute("cx")) * factor);
    }

    return [z,density];
}


function drawlines(svg) {
    let ll = svg.getElementById("lines");
    while (ll.hasChildNodes()) {
        ll.removeChild(ll.firstChild);
    }
    let drags = svg.getElementsByClassName("draggable");

    //console.log("drags",drags[0].getAttribute("cx"),drags[0].getAttribute("cx"));
    let svgNS = "http://www.w3.org/2000/svg";

    for (let i = 0; i < drags.length-1; i++) {
        let ll0 = document.createElementNS(svgNS,"line");
        ll0.setAttributeNS(null,"x1",drags[i].getAttribute("cx"));
        ll0.setAttributeNS(null,"y1",drags[i].getAttribute("cy"));
        ll0.setAttributeNS(null,"x2",drags[i+1].getAttribute("cx"));
        ll0.setAttributeNS(null,"y2",drags[i+1].getAttribute("cy"));
        ll0.setAttributeNS(null,"style","stroke:rgb(190,190,255);stroke-width:2")
        ll.appendChild(ll0);
    }
}

//
function makeDraggable(svg) {
    svg.addEventListener('mousedown', startDrag);
    svg.addEventListener('mousemove', drag);
    svg.addEventListener('mouseup', endDrag);
    svg.addEventListener('mouseleave', endDrag);
    svg.addEventListener('touchstart', startDrag);
    svg.addEventListener('touchmove', drag);
    svg.addEventListener('touchend', endDrag);
    svg.addEventListener('touchleave', endDrag);
    svg.addEventListener('touchcancel', endDrag);

    drawlines(svg);
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
            prev = selectedElement.previousElementSibling;
            if (prev) {
                coord.x = Math.max(coord.x,parseFloat(prev.getAttributeNS(null, "cx")));
                coord.y = Math.max(coord.y,parseFloat(prev.getAttributeNS(null, "cy")));
            }

            next = selectedElement.nextElementSibling;
            if (next) {
                coord.x = Math.min(coord.x,parseFloat(next.getAttributeNS(null, "cx")));
                coord.y = Math.min(coord.y,parseFloat(next.getAttributeNS(null, "cy")));
            }

            let dx = coord.x - offset.x;
            let dy = coord.y - offset.y;

            selectedElement.setAttributeNS(null, "cx", Math.max(dx,0));
            //selectedElement.setAttributeNS(null, "cy", dy);

            drawlines(svg);
        }


    }



    function endDrag(evt) {
        console.log("foo");
        drawlines(svg);


        selectedElement = false;
    }
}
