const fs = require('node:fs');
const path = require('node:path');
const output = path.resolve(__dirname, '../public');
fs.mkdirSync(output, { recursive: true });
fs.copyFileSync(require.resolve('canvaskit-wasm/bin/full/canvaskit.wasm'), path.join(output, 'canvaskit.wasm'));
