import {analyzeTriage} from '../triage/analyze.mjs';
import {object} from '../shared/data.mjs';

export function runAnalysis(kind, payload) {
  object(payload, 'analysis request');
  if (kind === 'triage') return analyzeTriage(payload);
  throw new Error('Unsupported analysis');
}
