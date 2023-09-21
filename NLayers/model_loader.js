import { MallocArray, pcolor, quiver, mouse_edit_mask } from "../julia_wasm_utils.js";

export async function run(document) {
    makeDraggable(document.getElementById("profile"));

    
    const response = await fetch('model.wasm');
    const bytes = await response.arrayBuffer();
    const { instance } = await WebAssembly.instantiate(bytes);

    const { julia_fluid_sim_step, memory, __heap_base } = instance.exports;

    // base[0] offset of memory, increased by MallocArray
    let base = [__heap_base];

    const sz = [300,100];
    const dx = 5000;
    var ntime = 0;

    let [mask_p, mask] = MallocArray(Int32Array,memory,base,sz);
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
        let DeltaT = parseFloat(document.getElementById("DeltaT").value);
        let pmin = parseFloat(document.getElementById("pmin").value);
        let pmax = parseFloat(document.getElementById("pmax").value);
        let show_velocity = document.getElementById("show_velocity").checked;

        if (!isNaN(grav) && !isNaN(f) && !isNaN(pmin) && !isNaN(pmax) && !isNaN(DeltaT)) {
            //console.log("p ",pressure[140 + sz[0] * 40]);

            const result = julia_fluid_sim_step(
                grav,f,dx,DeltaT,ntime,
                mask_p,h_p,hu_p,hv_p,pressure_p,u_p,v_p,newu_p,newv_p);

            ntime += 1;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            pcolor(ctx,sz,res,pressure,mask,{pmin: pmin, pmax: pmax});

            if (show_velocity) {
                quiver(ctx,sz,res,u,v,mask,{subsample: 5, scale: 500});

            }
        }
        window.requestAnimationFrame(step);
    }

    window.requestAnimationFrame(step);
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
        }
    }

    function drag(evt) {
        if (selectedElement) {
            evt.preventDefault();

            var coord = getMousePosition(evt);
            var dx = coord.x - offset.x;
            var dy = coord.y - offset.y;

            if (confined) {
                if (dx < minX) { dx = minX; }
                else if (dx > maxX) { dx = maxX; }
                if (dy < minY) { dy = minY; }
                else if (dy > maxY) { dy = maxY; }
            }

            transform.setTranslate(dx, dy);
        }


    }

    function endDrag(evt) {
        console.log("foo");
        var drags = svg.getElementsByClassName("draggable");

        console.log("drags",drags[0].getAttribute("cx"),drags[0].getAttribute("cx"));
        var svgNS = "http://www.w3.org/2000/svg";  
        var ll0 = document.createElementNS(svgNS,"line");
        ll0.setAttributeNS(null,"x1",drags[0].getAttribute("cx"));
        ll0.setAttributeNS(null,"y1",drags[0].getAttribute("cy"));
        ll0.setAttributeNS(null,"x2",drags[1].getAttribute("cx"));
        ll0.setAttributeNS(null,"y2",drags[1].getAttribute("cy"));
        ll0.setAttributeNS(null,"style","stroke:rgb(255,0,0);stroke-width:2")
        var ll = svg.getElementById("lines");
        ll.appendChild(ll0);


        selectedElement = false;
    }
}
