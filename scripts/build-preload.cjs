const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outJs = path.join('dist-electron', 'preload.js');
const outCjs = path.join('dist-electron', 'preload.cjs');

execSync('tsc -p tsconfig.preload.json', { stdio: 'inherit' });

if (!fs.existsSync(outJs)) {
  throw new Error('preload.js was not generated');
}

if (fs.existsSync(outCjs)) {
  fs.unlinkSync(outCjs);
}
fs.renameSync(outJs, outCjs);
