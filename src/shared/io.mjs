import fs from 'node:fs/promises';
import path from 'node:path';
import {assert, parseJSON, pretty, uid} from './data.mjs';
export async function readText(file, max = 20*1024*1024) {
  const stat=await fs.lstat(file);assert(stat.isFile()&&!stat.isSymbolicLink(), 'Input must be a regular, non-symlink file');
  assert(stat.size<=max, `Input exceeds ${max} bytes`); return fs.readFile(file,'utf8');
}
export async function readJSON(file) { return parseJSON(await readText(file),path.basename(file)); }
export async function safeParent(file) {
  const dir=path.dirname(path.resolve(file));
  let cursor=path.parse(dir).root;
  for(const bit of dir.slice(cursor.length).split(path.sep).filter(Boolean)) {
    cursor=path.join(cursor,bit);
    try {const s=await fs.lstat(cursor);assert(s.isDirectory()&&!s.isSymbolicLink(),'Output path contains a symlink or non-directory');}
    catch(e){if(e.code==='ENOENT')await fs.mkdir(cursor,{mode:0o700});else throw e;}
  }
}
export async function writeFile(file, data, force=false) {
  await safeParent(file);
  if(!force) {await fs.writeFile(file,data,{flag:'wx',mode:0o600});return;}
  try {const s=await fs.lstat(file);assert(s.isFile()&&!s.isSymbolicLink(),'Refusing to replace a symlink/non-file');}catch(e){if(e.code!=='ENOENT')throw e;}
  const temporary=file+'.'+uid()+'.tmp';
  await fs.writeFile(temporary,data,{flag:'wx',mode:0o600});
  try{await fs.rename(temporary,file);}finally{await fs.rm(temporary,{force:true});}
}
export async function writeJSON(file,value,force=false){await writeFile(file,pretty(value),force);}
export async function sourceFiles(root) {
  root=path.resolve(root);const stat=await fs.lstat(root);assert(stat.isDirectory()&&!stat.isSymbolicLink(),'Repository must be a non-symlink directory');
  const files=[];const warnings=[];let bytes=0;
  const ignored=new Set(['.git','node_modules','dist','build','coverage','.next','.nuxt','vendor','.cache','.venv','target','reports','artifacts']);
  async function walk(dir,depth=0){
    assert(depth<=30,'Source tree is too deep');
    for(const e of (await fs.readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))) {
      if(e.name.startsWith('.')||ignored.has(e.name))continue;
      const absolute=path.join(dir,e.name), relative=path.relative(root,absolute).split(path.sep).join('/');
      if(e.isSymbolicLink()){warnings.push(`Skipped symlink: ${relative}`);continue;}
      if(e.isDirectory())await walk(absolute,depth+1);
      else if(/\.(?:[cm]?[jt]sx?)$/.test(e.name)&&!e.name.endsWith('.min.js')){
        const size=(await fs.stat(absolute)).size;
        if(size>500000){warnings.push(`Skipped file over 500 KB: ${relative}`);continue;}
        bytes+=size;assert(bytes<=15*1024*1024&&files.length<1500,'Repository scan limit: 15 MiB / 1500 source files');
        files.push({path:relative,content:await fs.readFile(absolute,'utf8')});
      }
    }
  }
  await walk(root);return {files,warnings};
}
