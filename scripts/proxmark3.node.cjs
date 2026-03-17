const fs = require('fs');
const path = require('path');
const vm = require('vm');

const sourcePath = path.join(__dirname, '..', 'public', 'wasm', 'proxmark3.js');
const source = fs.readFileSync(sourcePath, 'utf8');

// The generated Emscripten bundle expects CommonJS globals in Node and spawns
// worker threads using __filename. Keeping these pointed at this wrapper makes
// the main thread and pthread workers load the same bootstrap path.
globalThis.require = require;
globalThis.module = module;
globalThis.exports = exports;
globalThis.__filename = __filename;
globalThis.__dirname = __dirname;

vm.runInThisContext(source, { filename: sourcePath });
