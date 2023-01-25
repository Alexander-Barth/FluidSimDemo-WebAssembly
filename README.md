
WebAssembly or WASM is a low level instruction set which allows running compiled language
inside a WebBrowser. For example C and Rust code can be compiled to WASM and then loaded and executed by the Browser runtile.

Technically one could also run intepreted language like Python (implemented in C)
in a webbrowser by compiling the interpreter to WASM.

Julia on the other hand, can be compiled ahead-of-time using StaticCompiler.jl and WASM is one of the enabled output target.

Encourage by post of running Julia with StaticCompiler.jl on an Adruino by [Seelengrab](https://github.com/Seelengrab), how difficult could it be run a non-trival julia code
in a WebBrowser using WASM?

Note Keno Fisher ported julia 1.3 to WASM using emscripten.
https://github.com/Keno/julia-wasm


This approach here use a subset of the Julia language and the array object of StaticTools.jl to create a small WASM program.

In particular:
* No dynamical memory allocation and garbage collector
* No code that could thow an an exception

The julia programming language does not get in your way to write low-level code.

We will use GPUCompiler to declare a WASMTarget and to emit WASM code. This is the file `wasm_target.jl` which we will use:

Note that we use 32-bit julia (on Linux) and 32-bit WASM format.
Using the 64-bit version (of julia or WASM format) did not work for me.

One of the simplest function would be to add two integers and return the sum. 

#include test_add.jl

The wasm object file is saved to `test_add.o` which can be inspected by `wasm2wat`.

```
$ wasm2wat test_add.o 
(module
  (type (;0;) (func (param i32 i32) (result i32)))
  (import "env" "__linear_memory" (memory (;0;) 0))
  (func $julia_add (type 0) (param i32 i32) (result i32)
    local.get 1
    local.get 0
    i32.add))
```

Note that the function add has been prefixed by `julia_`.

The linker step is necessary to export the `julia_add` function.

```
wasm-ld --no-entry --export-all -o test_add.wasm test_add.o
```

To test the WASM binary, it is convinient to use `node`. The code can be executed by runnning:

```bash
node test_add_node.js
```

where `test_add_node.js` is the file:

#include test_add_node.js

The Julia base array type can unfortunately, not been used by the array type of StaticTools.jl
is accepted the CPUCompiler.jl.

The memory layout is relatively simple:

https://github.com/brenhinkeller/StaticTools.jl/blob/480d7514304190cb6b8e71331d7119959d80e3e2/src/mallocarray.jl#L21-L25

So we have essentially:
* a function pointer
* the total numner of elements (`length`)
* a tuple with the size

The code `test_matrix_node.js` emulates such an array. For a matrix (2D array), there are thus 4 32-bit integers: pointer, number of elements, number of line and number of rows where the number of elements is the product of the number of rows and lines.

WASM exposes a special binary data buffer `memory.buffer` allocate such data structure. A pointer would then just be an index or rather offset relative to the start of this byte buffer. Using JavaScript typed array, a part of the buffer can be interpreted as a vector of 32-bit integer, 64-bit floating point number,...
JavaScript typed array are always one-dimensional, which correspond to a flatten view of the array seen from Julia. As a consequence, for
JavaScript typed array there is no additional difficulty concerning row-major or column-major matrix layout.


The example code `test_matrix.jl` sums over all elements of a matrix and in addition it mutates all elements by adding 1. Running the JavaScript code `test_matrix_node.js`
gives the expected output. As in Julia, scalar parameters (32/64-bit integer, floats) are passed by value while arrays are passed by reference and can thus changes are visible
by the caller.

As a final example we take a simple 2D fluid simulation solving the inviscic and incompressible Navier-Stokes equations.
It is based on the [compact implementation](https://github.com/matthias-research/pages/blob/master/tenMinutePhysics/17-fluidSim.html) of
Matthias Müller.





