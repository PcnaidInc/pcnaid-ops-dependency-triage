import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readJSON, sourceFiles} from '../shared/io.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const EXAMPLE_TIME = '2026-10-05T12:00:00.000Z';

export async function sample(kind = 'triage') {
  if (kind === 'triage') {
    const base = path.join(ROOT, 'examples/triage');
    const scan = await sourceFiles(path.join(base, 'repository'));
    return {
      before: await readJSON(path.join(base, 'before.package.json')),
      after: await readJSON(path.join(base, 'after.package.json')),
      baseLock: await readJSON(path.join(base, 'before.package-lock.json')),
      headLock: await readJSON(path.join(base, 'after.package-lock.json')),
      notes: await readJSON(path.join(base, 'notes.json')),
      files: scan.files,
      scanWarnings: scan.warnings,
      asOf: EXAMPLE_TIME
    };
  }
  throw new Error('Unknown sample kind: ' + kind);
}
