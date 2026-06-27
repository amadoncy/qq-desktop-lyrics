const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const outJs = path.join('dist-electron', 'preload.js');
const outCjs = path.join('dist-electron', 'preload.cjs');

function renamePreload() {
  if (!fs.existsSync(outJs)) return;
  if (fs.existsSync(outCjs)) {
    fs.unlinkSync(outCjs);
  }
  fs.renameSync(outJs, outCjs);
}

execSync('node scripts/build-preload.cjs', { stdio: 'inherit' });

let debounce = null;
fs.watch(path.dirname(outJs), (_event, filename) => {
  if (filename !== 'preload.js') return;
  clearTimeout(debounce);
  debounce = setTimeout(renamePreload, 100);
});

spawn('npx', ['tsc', '-p', 'tsconfig.preload.json', '--watch', '--preserveWatchOutput'], {
  stdio: 'inherit',
  shell: true,
});
