import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../src/runtime/samples.mjs';

let checked = 0;
for (const directory of ['bin', 'src', 'scripts', 'tests']) {
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, {withFileTypes: true})) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(file);
      else if (/\.(mjs|js)$/.test(file)) {
        const result = spawnSync(process.execPath, ['--check', file], {encoding: 'utf8'});
        if (result.status !== 0) throw new Error(result.stderr);
        checked++;
      }
    }
  }
  await walk(path.join(ROOT, directory));
}
console.log(`${checked} application/test JavaScript files passed syntax checks.`);
