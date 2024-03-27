import { MallocArray, pcolor, quiver, mouse_edit_mask } from "../julia_wasm_utils.js";

export async function run(document) {
    makeDraggable(document.getElementById("profile"));


    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_nlayer_step_init, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const imax = 101;
    const m = 5;
    const dx = 1000;
    const dt = 28.73;
    const grav = 9.81;

    var ntime = 0;

    // n,dx,dt,g,rho,P,h,hm,hu,u,z,bottom
    let [rho_p, rho] = MallocArray(Float32Array,memory,base,[m]);
    let [P_p, P] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [h_p, h] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [hm_p, hm] = MallocArray(Float32Array,memory,base,[imax,m]);
    let [hu_p, hu] = MallocArray(Float32Array,memory,base,[imax+1,m]);
    let [u_p, u] = MallocArray(Float32Array,memory,base,[imax+1,m]);
    let [z_p, z] = MallocArray(Float32Array,memory,base,[imax,m+1]);
    let [bottom_p, bottom] = MallocArray(Float32Array,memory,base,[imax]);

/*    rho[0] = 1020;
    rho[1] = 1035;
    rho[2] = 1050;
    rho[3] = 1065;
    rho[4] = 1080;
*/

    for (let i = 0; i < imax; i++) {
        bottom[i] = 100;
        for (let k = 0; k < m; k++) {
            hm[i + k*imax] = bottom[i]/m;
        }
    }

    // canvas for plotting
    const canvas = document.getElementById("plot");
    var svg = document.getElementById("profile");

    var ctx = canvas.getContext("2d");
    ctx.transform(1, 0, 0, -1, 0, canvas.height)

    function step(timestamp) {
        let grav = parseFloat(document.getElementById("grav").value);
        let f = parseFloat(document.getElementById("f").value);
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let show_velocity = document.getElementById("show_velocity").checked;
        let [profile_z,profile_density] = getProfile(svg);


        console.log(profile_density);

        for (let k = 0; k < m; k++) {
            rho[k] = profile_density[k];
        }


        if (!isNaN(grav) && !isNaN(f) && !isNaN(DeltaT)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            const result = julia_nlayer_step_init(
                ntime,dx,DeltaT,grav,
                rho_p,P_p,h_p,hm_p,hu_p,u_p,z_p,bottom_p);


            ntime += 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let scalex = canvas.width/(imax-1);
            let scaley = canvas.height/100;

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


function getProfile(svg) {
    var drags = svg.getElementsByClassName("draggable");

    var z = [];
    var density = [];

    let density_min =  1020;
    let density_max =  1060;
    let factor = (density_max - density_min) / document.getElementById("profile").width.baseVal.value;

    for (var i = 0; i < drags.length; i++) {
        z.push(parseFloat(drags[drags.length-i-1].getAttribute("cy")));
        density.push(density_min + parseFloat(drags[drags.length-i-1].getAttribute("cx")) * factor);
    }

    return [z,density];
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
    var selectedElement, offset, transform,
        bbox, minX, maxX, minY, maxY, confined;

    var boundaryX1 = 10.5;
    var boundaryX2 = 30;
    var boundaryY1 = 2.2;
    var boundaryY2 = 19.2;

    function getMousePosition(evt) {
        var CTM = svg.getScreenCTM();
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
            var transforms = selectedElement.transform.baseVal;

            if (transforms.length === 0 || transforms.getItem(0).type !== SVGTransform.SVG_TRANSFORM_TRANSLATE) {
                // Create an transform that translates by (0, 0)
                var translate = svg.createSVGTransform();
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


            var coord = getMousePosition(evt);

            // constrait position
            // density must to monotonic
            var prev, next;
            prev = selectedElement.previousElementSibling;
            if (prev) {
                coord.x = Math.min(coord.x,parseFloat(prev.getAttributeNS(null, "cx")));
                coord.y = Math.min(coord.y,parseFloat(prev.getAttributeNS(null, "cy")));
            }

            next = selectedElement.nextElementSibling;
            if (next) {
                coord.x = Math.max(coord.x,parseFloat(next.getAttributeNS(null, "cx")));
                coord.y = Math.max(coord.y,parseFloat(next.getAttributeNS(null, "cy")));
            }

            var dx = coord.x - offset.x;
            var dy = coord.y - offset.y;

            selectedElement.setAttributeNS(null, "cx", dx);
            selectedElement.setAttributeNS(null, "cy", dy);



            drawlines(svg);
        }


    }


    function drawlines(svg) {
        var ll = svg.getElementById("lines");
        while (ll.hasChildNodes()) {
            ll.removeChild(ll.firstChild);
        }
        var drags = svg.getElementsByClassName("draggable");

        //console.log("drags",drags[0].getAttribute("cx"),drags[0].getAttribute("cx"));
        var svgNS = "http://www.w3.org/2000/svg";

        for (var i = 0; i < drags.length-1; i++) {
            var ll0 = document.createElementNS(svgNS,"line");
            ll0.setAttributeNS(null,"x1",drags[i].getAttribute("cx"));
            ll0.setAttributeNS(null,"y1",drags[i].getAttribute("cy"));
            ll0.setAttributeNS(null,"x2",drags[i+1].getAttribute("cx"));
            ll0.setAttributeNS(null,"y2",drags[i+1].getAttribute("cy"));
            ll0.setAttributeNS(null,"style","stroke:rgb(190,190,255);stroke-width:2")
            ll.appendChild(ll0);
        }
    }

    function endDrag(evt) {
        console.log("foo");
        drawlines(svg);


        selectedElement = false;
    }
}
