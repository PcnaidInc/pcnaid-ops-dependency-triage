import path from 'node:path';
import {sample, ROOT} from '../src/runtime/samples.mjs';
import {runAnalysis} from '../src/runtime/service.mjs';
import {saveReport} from '../src/cli.mjs';

const report = runAnalysis('triage', await sample('triage'));
await saveReport(report, path.join(ROOT, 'reports', 'triage'), {force: true});
console.log('triage', JSON.stringify(report.summary));
console.log('Fictional sample packet regenerated in reports/.');
