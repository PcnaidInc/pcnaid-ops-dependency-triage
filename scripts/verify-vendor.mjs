import fs from 'node:fs/promises';import path from 'node:path';import {ROOT} from '../src/runtime/samples.mjs';import {sha256,assert} from '../src/shared/data.mjs';
const manifest=JSON.parse(await fs.readFile(path.join(ROOT,'vendor-manifest.json'),'utf8'));
let checked=0;for(const [file,hash]of Object.entries(manifest.files)){assert(file.startsWith('vendor/')&&!file.includes('..'),'Invalid vendor path');const bytes=await fs.readFile(path.join(ROOT,file));assert(sha256(bytes)===hash,'Vendor integrity mismatch: '+file);checked++;}
console.log(`${checked} vendored files match the delivered manifest. This is an integrity check, not a live vulnerability audit.`);
