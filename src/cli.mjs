import path from 'node:path';
import fs from 'node:fs/promises';
import {readJSON, writeFile, writeJSON, sourceFiles} from './shared/io.mjs';
import {assert, pretty} from './shared/data.mjs';
import {analyzeTriage} from './triage/analyze.mjs';
import {collectReleases} from './triage/releases.mjs';
import {renderReport, csvReport, packet} from './shared/reports.mjs';

export const HELP = `Pcnaid Dependency Triage Tool 0.1.0 — npm upgrade prioritization

  triage --before old.package.json --after new.package.json --repo ./repository
         [--base-lock old.lock.json] [--head-lock new.lock.json]
         [--notes notes.json] --out reports/upgrade [--as-of ISO]
         [--fail-on review|migration_required]
  releases --repository owner/repo --package npm-name --from 1.0.0 --to 2.0.0
           --out notes.json [--max-pages 5]

--force explicitly permits replacement of output files. Existing paths otherwise fail.
The releases command is the only network mode. It issues GET requests.
No command installs packages, runs repository code, transfers assets, or merges PRs.
`;

const FLAGS = new Set(['force', 'help']);
const ALLOWED = {
  triage: ['before', 'after', 'repo', 'base-lock', 'head-lock', 'notes', 'out', 'as-of', 'fail-on'],
  releases: ['repository', 'package', 'from', 'to', 'out', 'max-pages']
};

function parseArgs(argv) {
  let [command, ...rest] = argv;
  if (command && command.startsWith('--')) {
    rest = [command, ...rest];
    command = 'triage';
  }
  assert(Object.hasOwn(ALLOWED, command), `Unknown command ${command}. Run --help.`);
  const options = {};
  for (let i = 0; i < rest.length; i++) {
    const key = rest[i];
    assert(/^--[a-z][a-z-]*$/.test(key), 'Expected --option followed by a value');
    const name = key.slice(2);
    assert(ALLOWED[command].includes(name) || ['force', 'help'].includes(name), `Unknown option ${key}`);
    const value = FLAGS.has(name) ? true : rest[++i];
    assert(value !== undefined && !String(value).startsWith('--'), `Missing value for ${key}`);
    if (Object.hasOwn(options, name)) {
      assert(false, 'Duplicate option ' + key);
    } else options[name] = value;
  }
  return {command, options};
}

const need = (o, k) => {
  assert(typeof o[k] === 'string' && o[k].length > 0, `--${k} is required and must occur once`);
  return o[k];
};

export async function saveReport(report, out, {force = false} = {}) {
  const files = {
    'report.json': pretty(report),
    'report.html': renderReport(report),
    'findings.csv': csvReport(report),
    'packet.zip': packet(report)
  };
  if (!force) {
    for (const name of Object.keys(files)) {
      try {
        await fs.lstat(path.join(out, name));
        throw new Error('Output already exists: ' + path.join(out, name));
      } catch (e) {
        if (e.code !== 'ENOENT') throw e;
      }
    }
  }
  for (const [name, value] of Object.entries(files)) await writeFile(path.join(out, name), value, force);
  return path.resolve(out);
}

export async function main(argv = process.argv.slice(2)) {
  if (!argv.length || argv[0] === '--help' || argv[0] === 'help') {
    console.log(HELP);
    return;
  }
  const {command, options: o} = parseArgs(argv);
  if (o.help) {
    console.log(HELP);
    return;
  }
  const force = !!o.force;
  let report;
  if (command === 'triage') {
    const scan = await sourceFiles(need(o, 'repo'));
    report = analyzeTriage({
      before: await readJSON(need(o, 'before')),
      after: await readJSON(need(o, 'after')),
      baseLock: o['base-lock'] ? await readJSON(o['base-lock']) : null,
      headLock: o['head-lock'] ? await readJSON(o['head-lock']) : null,
      notes: o.notes ? await readJSON(o.notes) : [],
      files: scan.files,
      scanWarnings: scan.warnings,
      ...(o['as-of'] ? {asOf: o['as-of']} : {})
    });
    if (o['fail-on']) assert(['review', 'migration_required'].includes(o['fail-on']), '--fail-on must be review or migration_required');
  } else if (command === 'releases') {
    const result = await collectReleases({
      repository: need(o, 'repository'),
      packageName: need(o, 'package'),
      from: need(o, 'from'),
      to: need(o, 'to'),
      token: process.env.GITHUB_TOKEN ?? null,
      maxPages: o['max-pages'] ? Number(o['max-pages']) : 5
    });
    await writeJSON(need(o, 'out'), result.notes, force);
    console.log(pretty({notes: result.notes.length, coverage: result.coverage, warnings: result.warnings}));
    return;
  }
  if (report) {
    const out = await saveReport(report, need(o, 'out'), {force});
    console.log(`${report.kind}: ${out}`);
    console.log(pretty(report.summary));
    if (command === 'triage' && o['fail-on'] && report.updates.some(u => u.label === 'migration_required' || (o['fail-on'] === 'review' && u.label === 'review'))) {
      process.exitCode = 2;
    }
  }
}
