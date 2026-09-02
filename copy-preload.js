import fs from 'fs';
import path from 'path';

const src = path.resolve('electron/preload.cjs');
const dest = path.resolve('dist-electron/preload.cjs');

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log('[Build] Copied electron/preload.cjs -> dist-electron/preload.cjs');
}
