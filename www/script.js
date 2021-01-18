// - Stores references to items which can't be directly passed to WASM
// - Perf: Potential "fragmentation" if used to store too many long-lived
//         objects
class PointerCache {
    constructor() {
        this.counter = 0;
        this.cache = new Map();
    }

    increment() {
        var rtn = this.counter;
        // Usually only has one iteration
        do {
            // Note that counter is always less than MAX, so adding 1 is safe
            this.counter = (this.counter+1) % Number.MAX_SAFE_INTEGER;
        } while (this.cache.has(this.counter))
        return rtn;
    }

    store(obj) {
        var i = this.increment();
        this.cache.set(i, obj);
        return i;
    }

    peek(i) { return this.cache.get(i); }

    pop(i) {
        var rtn = this.cache.get(i);
        this.cache.delete(i);
        return rtn;
    }
};

// - Utilities for interacting with WASM
// - Allows for WASM implementation of calling convention for complex objects
// - Clunky 2-stage initialization -- Call init() at most once
// - Perf: Using this calling convention _can_ incur extra copies
class Wasm {
    constructor() {
        this.mem = undefined;
        this.env = {};
        this.cache = new PointerCache();
    }

    init(resp) {
        this.env.__len = (...a) => this.len(...a);
        this.env.__copy = (...a) => this.copy(...a);
        this.env.__pop = (...a) => {this.cache.pop(...a);return;}
        return WebAssembly.instantiateStreaming(resp, {env: this.env})
            .then(wasm => wasm.instance)
            .then(instance => {
                this.mem = instance.exports.memory;
                return instance.exports;
            });
    }

    bind(serdes) {
        var ser = (obj) => this.cache.store(serdes.ser(obj));
        var des = (ptr, len) => serdes.des(this.read(ptr, len));
        return { ser, des };
    }

    read(ptr, len) { return new Uint8Array(this.mem.buffer, ptr, len); }

    wrap(f) { return (...args) => this.cache.store(f(...args)); }

    len(i) { return this.cache.peek(i).length; }

    copy(i, ptr) {
        var dat = this.cache.pop(i);
        var buf = this.read(ptr, dat.length);
        buf.set(dat, 0);
    }
}

class TextSerdes {
    constructor(...args) {
        this.enc = new TextEncoder(...args);
        this.dec = new TextDecoder(...args);
    }

    ser(text) { return this.enc.encode(text); }
    des(raw) {return this.dec.decode(raw); }
}
const utf8Serdes = new TextSerdes('utf-8');

var wasm = new Wasm();
var utf = wasm.bind(utf8Serdes);
wasm.env.consoleLog = (ptr, len) => console.log(utf.des(ptr, len));
wasm.env.sampleDat = wasm.wrap(() => new Uint8Array([43, 55, 67]));

fetch('main.wasm')
.then(r => wasm.init(r))
.then(mod => mod.main());
