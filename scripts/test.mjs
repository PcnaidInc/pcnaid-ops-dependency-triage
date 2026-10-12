import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ROOT} from '../src/runtime/samples.mjs';

const files = (await fs.readdir(path.join(ROOT, 'tests'))).filter(f => f.endsWith('.test.mjs')).sort().map(f => path.join(ROOT, 'tests', f));
const child = spawnSync(process.execPath, ['--test', ...files], {cwd: ROOT, stdio: 'inherit'});
process.exitCode = child.status ?? 1;
