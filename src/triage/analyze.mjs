import ts from '../../vendor/typescript/typescript.cjs';
import semver from '../../vendor/semver/index.js';
import {assert, object, array, string, sha256, VERSION, sanitize, timestamp} from '../shared/data.mjs';
const groups=['dependencies','devDependencies','optionalDependencies','peerDependencies'];
const testPath=p=>/(?:^|\/)(?:__tests__|tests?|specs?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/.test(p);
const packageRoot=name=>name.startsWith('@')?name.split('/').slice(0,2).join('/'):name.split('/')[0];
function manifest(raw,name){object(raw,name);for(const key of groups)if(raw[key]!==undefined){object(raw[key],`${name}.${key}`);for(const [k,v]of Object.entries(raw[key])){string(k,'package name',300);string(v,'version selector',300);}}return raw;}
function lockEntries(raw,label,warnings){
  if(raw==null)return new Map();object(raw,label);
  if(![2,3].includes(raw.lockfileVersion)){warnings.push(`${label}: only npm package-lock v2/v3 is supported; resolved versions were not inferred.`);return new Map();}
  object(raw.packages,`${label}.packages`);const out=new Map();
  for(const [location,value]of Object.entries(raw.packages)){
    if(!location.includes('node_modules/'))continue;
    object(value,`lockfile entry ${location}`);
    if(value.link){warnings.push(`Linked package was not resolved: ${location}`);continue;}
    if(!value.version){warnings.push(`Unversioned package was not resolved: ${location}`);continue;}
    const name=location.slice(location.lastIndexOf('node_modules/')+'node_modules/'.length);
    out.set(location,{name,version:String(value.version),engines:value.engines??{},peerDependencies:value.peerDependencies??{}});
  }return out;
}
function dependencies(before,after,baseLock,headLock,warnings){
  const old=lockEntries(baseLock,'base lockfile',warnings),current=lockEntries(headLock,'head lockfile',warnings),result=[];
  const direct=new Map();for(const g of groups)for(const name of new Set([...Object.keys(before[g]??{}),...Object.keys(after[g]??{})])){
    if(!direct.has(name))direct.set(name,{groups:[],before:null,after:null,beforeGroups:[],afterGroups:[]});
    const entry=direct.get(name);entry.groups.push(g);
    for(const [side,data]of [['before',before],['after',after]])if(data[g]?.[name]){if(entry[side]&&entry[side]!==data[g][name])warnings.push(`Conflicting ${side} selectors across dependency groups: ${name}`);entry[side]??=data[g][name];entry[side+'Groups'].push(g);}
  }
  for(const [name,info]of direct){
    const loc=`node_modules/${name}`;const a=old.get(loc),b=current.get(loc);
    const from=a?.version??(info.before&&semver.valid(info.before)?info.before:null),to=b?.version??(info.after&&semver.valid(info.after)?info.after:null);
    const scopeChanged=JSON.stringify(info.beforeGroups)!==JSON.stringify(info.afterGroups);
    if(info.before===info.after&&from===to&&!scopeChanged)continue;
    result.push({package:name,path:loc,direct:true,groups:info.groups,scopeChanged,from,to,fromSelector:info.before,toSelector:info.after,change:!info.before?'added':!info.after?'removed':from!==to?'version':'selector',headEngines:b?.engines??{},headPeers:b?.peerDependencies??{},baseEngines:a?.engines??{},basePeers:a?.peerDependencies??{}});
  }
  for(const loc of new Set([...old.keys(),...current.keys()])){
    const a=old.get(loc),b=current.get(loc),name=b?.name??a.name;
    if(direct.has(name)&&loc===`node_modules/${name}`)continue;
    if(a?.version===b?.version)continue;
    result.push({package:name,path:loc,direct:false,groups:['transitive'],from:a?.version??null,to:b?.version??null,fromSelector:null,toSelector:null,change:!a?'added':!b?'removed':'version',headEngines:b?.engines??{},headPeers:b?.peerDependencies??{},baseEngines:a?.engines??{},basePeers:a?.peerDependencies??{}});
  }
  if(!baseLock||!headLock)warnings.push('One or both lockfiles are missing. Version ranges are not resolved, and transitive updates may be absent.');
  if(before.workspaces||after.workspaces)warnings.push('Workspace manifests are not expanded automatically. Root manifests and supplied npm lock entries are analyzed; run separately for each workspace manifest.');
  return result;
}
function validateFiles(files){
  array(files,'files',1500);let total=0;const seen=new Set();
  for(const f of files){object(f,'source file');string(f.path,'file.path',500);assert(!f.path.startsWith('/')&&!f.path.includes('\\')&&!f.path.split('/').some(x=>['..','.',''].includes(x))&&!f.path.includes(':'),'Source paths must be relative POSIX paths without traversal');assert(/\.[cm]?[jt]sx?$/.test(f.path),'Only JS/TS source files are accepted');assert(typeof f.content==='string'&&Buffer.byteLength(f.content)<=500000,'Each source file must be <=500 KB');total+=Buffer.byteLength(f.content);assert(total<=15*1024*1024,'Source input exceeds 15 MiB');assert(!seen.has(f.path),`Duplicate source path ${f.path}`);seen.add(f.path);}
  return files;
}
export function scanUsage(files,packageNames){
  validateFiles(files);const names=new Set(packageNames),sources=new Map(files.map(f=>['/'+f.path,f.content]));
  const options={noLib:true,noResolve:true,allowJs:true,checkJs:false,target:ts.ScriptTarget.Latest,jsx:ts.JsxEmit.Preserve};
  const cache=new Map();
  const host={getSourceFile:(file,lang)=>{if(!sources.has(file))return undefined;if(!cache.has(file))cache.set(file,ts.createSourceFile(file,sources.get(file),lang,true));return cache.get(file);},getDefaultLibFileName:()=>'',writeFile:()=>{},getCurrentDirectory:()=> '/',getDirectories:()=>[],fileExists:f=>sources.has(f),readFile:f=>sources.get(f),getCanonicalFileName:f=>f,useCaseSensitiveFileNames:()=>true,getNewLine:()=> '\n'};
  const program=ts.createProgram([...sources.keys()],options,host),checker=program.getTypeChecker(),usage=[],imports=[],warnings=[];
  const addUsage=(sf,node,binding,kind,symbol)=>{
    if(usage.length>=20000){if(!warnings.includes('Usage output capped at 20,000 locations.'))warnings.push('Usage output capped at 20,000 locations.');return;}
    const lc=sf.getLineAndCharacterOfPosition(node.getStart(sf));
    usage.push({package:binding.package,importPath:binding.importPath,path:sf.fileName.slice(1),line:lc.line+1,column:lc.character+1,symbol:symbol??binding.imported,localName:binding.local,kind,test:testPath(sf.fileName),snippet:sf.text.split(/\r?\n/)[lc.line]?.trim().slice(0,250)??'',certainty:'static_reference'});
  };
  for(const sf of program.getSourceFiles()){
    for(const d of program.getSyntacticDiagnostics(sf).slice(0,10))warnings.push(`Parse warning in ${sf.fileName.slice(1)}: ${ts.flattenDiagnosticMessageText(d.messageText,' ')}`);
    const bindings=[];
    function bind(node,imported,importPath){const pkg=packageRoot(importPath);if(!names.has(pkg))return;bindings.push({symbol:checker.getSymbolAtLocation(node),package:pkg,importPath,imported,local:node.text});}
    function collect(node){
      if(ts.isImportDeclaration(node)&&ts.isStringLiteral(node.moduleSpecifier)){
        const mod=node.moduleSpecifier.text,pkg=packageRoot(mod);
        if(names.has(pkg)){const lc=sf.getLineAndCharacterOfPosition(node.getStart());imports.push({package:pkg,importPath:mod,path:sf.fileName.slice(1),line:lc.line+1,typeOnly:!!node.importClause?.isTypeOnly});}
        const c=node.importClause;
        if(c?.name)bind(c.name,'default',mod);
        if(c?.namedBindings){if(ts.isNamespaceImport(c.namedBindings))bind(c.namedBindings.name,'*',mod);else for(const e of c.namedBindings.elements)bind(e.name,e.propertyName?.text??e.name.text,mod);}
      }
      if(ts.isVariableDeclaration(node)&&node.initializer&&ts.isCallExpression(node.initializer)){
        const init=node.initializer;
        if(ts.isIdentifier(init.expression)&&init.expression.text==='require'&&init.arguments.length===1&&ts.isStringLiteral(init.arguments[0])){
          // A local declaration named require shadows CommonJS require; do not attribute it.
          const requireSymbol=checker.getSymbolAtLocation(init.expression);
          if(requireSymbol?.declarations?.some(d=>d.getSourceFile()===sf))return;
          const mod=init.arguments[0].text;
          if(names.has(packageRoot(mod))){const lc=sf.getLineAndCharacterOfPosition(node.getStart());imports.push({package:packageRoot(mod),importPath:mod,path:sf.fileName.slice(1),line:lc.line+1,typeOnly:false});}
          if(ts.isIdentifier(node.name))bind(node.name,'*',mod);
          else if(ts.isObjectBindingPattern(node.name))for(const e of node.name.elements)if(ts.isIdentifier(e.name))bind(e.name,e.propertyName?.getText(sf)??e.name.text,mod);
        }
      }
      if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword){
        if(node.arguments[0]&&ts.isStringLiteral(node.arguments[0])&&names.has(packageRoot(node.arguments[0].text)))warnings.push(`Dynamic import of ${node.arguments[0].text} in ${sf.fileName.slice(1)}: downstream alias flow is not followed.`);
      }
      if(ts.isExportDeclaration(node)&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier)&&names.has(packageRoot(node.moduleSpecifier.text)))warnings.push(`Re-export of ${node.moduleSpecifier.text} in ${sf.fileName.slice(1)}: downstream cross-file aliases are not followed.`);
      ts.forEachChild(node,collect);
    }
    collect(sf);
    function visit(node){
      if(ts.isImportDeclaration(node))return;
      if(ts.isIdentifier(node)){
        const symbol=checker.getSymbolAtLocation(node),binding=bindings.find(b=>b.symbol&&b.symbol===symbol);
        if(binding&&!symbol.declarations?.some(d=>d.name===node)){
          let use=node,member=binding.imported;
          if(ts.isPropertyAccessExpression(node.parent)&&node.parent.expression===node){use=node.parent;member=binding.imported==='*'||binding.imported==='default'?node.parent.name.text:`${binding.imported}.${node.parent.name.text}`;}
          else if(ts.isElementAccessExpression(node.parent)&&node.parent.expression===node&&ts.isStringLiteral(node.parent.argumentExpression)){use=node.parent;member=node.parent.argumentExpression.text;}
          const kind=ts.isCallExpression(use.parent)&&use.parent.expression===use?'call':ts.isNewExpression(use.parent)&&use.parent.expression===use?'construct':'reference';
          addUsage(sf,use,binding,kind,member);
        }
      }
      ts.forEachChild(node,visit);
    }visit(sf);
  }
  return {usage,imports,warnings:[...new Set(warnings)]};
}
function releaseEvidence(notes,dep){
  array(notes,'notes',1000);const relevant=[];
  for(const n of notes){object(n,'release note');string(n.package,'note.package',300);if(n.package!==dep.package)continue;string(n.version,'note.version',100);if(!semver.valid(n.version)||!dep.to||!semver.valid(dep.to)||!dep.from||!semver.valid(dep.from))continue;
    if(!semver.gt(n.version,dep.from)||!semver.lte(n.version,dep.to))continue;
    string(n.text,'note.text',100000);let url=null;
    if(n.url){const u=new URL(n.url);assert(u.protocol==='https:'&&!u.username&&!u.password,'Evidence links must be HTTPS without credentials');url=u.href;}
    const statements=[];
    for(const [i,line] of n.text.split(/\r?\n/).entries()){
      const kind=/\b(remov(?:e[ds]?|ing)|breaking)\b/i.test(line)?'breaking':/\bdeprecat/i.test(line)?'deprecated':/\b(security|CVE-\d|vulnerability)\b/i.test(line)?'security':/\b(behavior|behaviour|migration|configuration|requires?|minimum|node\.js)\b/i.test(line)?'behavior':null;
      if(kind){const symbols=[...line.matchAll(/`([A-Za-z_$][\w$.]*)`/g)].map(m=>m[1]);statements.push({kind,text:line.trim().slice(0,1000),symbols,line:i+1});}
    }
    relevant.push({version:n.version,url,source:n.source==='github_api'?'github_api':'user_supplied',sha256:sha256(n.text),statements});
  }
  return relevant;
}
export function analyzeTriage({before,after,baseLock=null,headLock=null,files=[],notes=[],scanWarnings=[],asOf=new Date().toISOString()}){
  manifest(before,'before');manifest(after,'after');timestamp(asOf);array(scanWarnings,'scanWarnings',10000);const warnings=[...scanWarnings];
  const updates=dependencies(before,after,baseLock,headLock,warnings);assert(updates.length<=2000,'Too many dependency changes (max 2000)');
  const scan=scanUsage(files,updates.map(d=>d.package));warnings.push(...scan.warnings);
  const rows=updates.map(dep=>{
    const usage=scan.usage.filter(u=>u.package===dep.package),imports=scan.imports.filter(u=>u.package===dep.package),evidence=releaseEvidence(notes,dep),reasons=[],matches=[];
    let label='routine';const escalate=()=>{if(label==='routine')label='review';};
    const change=dep.from&&dep.to&&semver.valid(dep.from)&&semver.valid(dep.to)?semver.diff(dep.from,dep.to):null;
    if(dep.scopeChanged){escalate();reasons.push('Dependency declaration groups changed; verify runtime versus development availability.');}
    if(dep.change==='added'||dep.change==='removed'){escalate();reasons.push(`Dependency ${dep.change}; this is not a routine version-only update.`);}
    if(!dep.from||!dep.to){escalate();reasons.push('One or both exact versions are unresolved or absent.');}
    if(change?.includes('major')){escalate();reasons.push('The version pair crosses a major release boundary.');}
    if((dep.to&&semver.valid(dep.to)&&semver.prerelease(dep.to))||(dep.from&&semver.valid(dep.from)&&semver.prerelease(dep.from))){escalate();reasons.push('A prerelease version is involved.');}
    if(dep.from&&dep.to&&semver.valid(dep.from)&&semver.valid(dep.to)&&semver.lt(dep.to,dep.from)){escalate();reasons.push('Version decreased; upgrade release-note range is not applicable.');}
    if(dep.from&&semver.valid(dep.from)&&semver.major(dep.from)===0&&change){escalate();reasons.push('The package is pre-1.0; compatibility should not be inferred from a minor or patch increment.');}
    if(!evidence.length){escalate();reasons.push('No applicable upstream release evidence was supplied; silence is not a safety signal.');}
    if(JSON.stringify(dep.headEngines)!==JSON.stringify(dep.baseEngines)){escalate();reasons.push('The lockfile records changed runtime engine constraints.');}
    if(JSON.stringify(dep.headPeers)!==JSON.stringify(dep.basePeers)){escalate();reasons.push('The lockfile records changed peer dependency requirements.');}
    if(!dep.direct){escalate();reasons.push('Transitive update: references to the package name are not a resolved installed-instance call graph.');}
    for(const release of evidence)for(const statement of release.statements){
      if(['breaking','deprecated','behavior','security'].includes(statement.kind)){escalate();reasons.push(`${statement.kind} signal in ${release.version}: ${statement.text}`);}
      const affected=usage.filter(u=>statement.symbols.some(s=>u.symbol===s||u.symbol.startsWith(s+'.')));
      if(affected.length){matches.push({version:release.version,url:release.url,evidenceLine:statement.line,statement:statement.text,kind:statement.kind,locations:affected});if(statement.kind==='breaking')label='migration_required';}
    }
    if(!files.length||!usage.length){escalate();reasons.push(!files.length?'No source files were provided.':'No direct static symbol references found; runtime use, configuration, build tooling, or alias propagation may still be affected.');}
    if(warnings.length){escalate();reasons.push('Input/scan coverage warnings require review.');}
    if(!reasons.length)reasons.push('No escalation signal was detected in the provided version pair, notes, and static references. This is not a merge approval.');
    const tests=[...new Set(usage.filter(x=>x.test).map(x=>x.path))];
    return {...dep,versionCategory:change??'unresolved',label,reasons:[...new Set(reasons)],evidence,usage,imports,matches,relatedTests:tests,coverage:{releaseEvidence:evidence.length?'provided_not_exhaustive':'missing',sourceFiles:files.length,staticReferences:usage.length,tests:tests.length?'direct_package_references_only':'not_identified'},checklist:['Read the original upstream notes across the full version interval.','Review the cited locations and any wrappers, configuration, build hooks, or dynamic imports.','Run the repository’s normal type checks and full relevant tests in an isolated trusted runner.',...(tests.length?[`Review directly associated test files: ${tests.join(', ')}`]:['Identify integration tests manually; absence here does not establish missing test coverage.']),'Obtain human review; this tool never installs dependencies, changes code, or merges a PR.']};
  });
  const counts={routine:0,review:0,migration_required:0};for(const r of rows)counts[r.label]++;
  return sanitize({kind:'triage',version:VERSION,generatedAt:timestamp(asOf),project:after.name??'npm project',inputSha256:sha256({before,after,baseLock,headLock,files,notes}),summary:{updates:rows.length,sourceFiles:files.length,labels:counts},updates:rows,warnings:[...new Set(warnings)],limitations:['Heuristic review prioritization, not a proven breakage predictor or security audit.','Migration required is an advisory match between breaking-language evidence and a static reference, not an executed compatibility test.','ESM import bindings and simple CommonJS bindings use the TypeScript compiler API; local shadowing is distinguished.','Cross-file re-exports, alias reassignment, dynamic module names, runtime behavior, and full test dependency graphs are not resolved.','Release-note extraction uses conservative textual signals, not a complete semantic API diff.','Root npm manifests and package-lock v2/v3 are supported; yarn/pnpm, lock v1, and automatic workspace expansion are not.','The tool does not execute repository code, run package installation scripts, fetch code, or call an LLM.']});
}
