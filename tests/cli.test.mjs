import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {ROOT} from '../src/runtime/samples.mjs';

const invoke = args => spawnSync(process.execPath, ['bin/pcnaid-triage.mjs', ...args], {cwd: ROOT, encoding: 'utf8'});

test('CLI help works without package install', () => assert.match(invoke(['--help']).stdout, /No command installs packages/));
test('CLI rejects unknown options', () => assert.equal(invoke(['triage', '--typo', 'value']).status, 1));
test('CLI triage fail-on returns policy exit 2 after writing report', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcnaid-triage-'));
  try {
    const result = invoke([
      'triage',
      '--before', 'examples/triage/before.package.json',
      '--after', 'examples/triage/after.package.json',
      '--base-lock', 'examples/triage/before.package-lock.json',
      '--head-lock', 'examples/triage/after.package-lock.json',
      '--repo', 'examples/triage/repository',
      '--notes', 'examples/triage/notes.json',
      '--out', dir,
      '--fail-on', 'migration_required'
    ]);
    assert.equal(result.status, 2, result.stderr);
    assert((await fs.stat(path.join(dir, 'packet.zip'))).size > 100);
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
test('benchmark harness computes metrics from explicitly synthetic labels', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'pcnaid-benchmark-'));
  try {
    const cases = [{
      id: 'synthetic-only',
      before: path.join(ROOT, 'examples/triage/before.package.json'),
      after: path.join(ROOT, 'examples/triage/after.package.json'),
      repo: path.join(ROOT, 'examples/triage/repository'),
      baseLock: path.join(ROOT, 'examples/triage/before.package-lock.json'),
      headLock: path.join(ROOT, 'examples/triage/after.package-lock.json'),
      notes: path.join(ROOT, 'examples/triage/notes.json'),
      actualRepairRequired: true,
      outcomeEvidence: 'Synthetic declared label for harness testing; not a real compatibility experiment.'
    }];
    await fs.writeFile(path.join(dir, 'cases.json'), JSON.stringify(cases));
    const run = spawnSync(process.execPath, ['scripts/benchmark.mjs', path.join(dir, 'cases.json'), path.join(dir, 'results.json')], {cwd: ROOT, encoding: 'utf8'});
    assert.equal(run.status, 0, run.stderr);
    const result = JSON.parse(await fs.readFile(path.join(dir, 'results.json'), 'utf8'));
    assert.equal(result.metrics.migrationSignal.tp, 1);
    assert(result.limitations.some(x => x.includes('synthetic')));
  } finally {
    await fs.rm(dir, {recursive: true, force: true});
  }
});
