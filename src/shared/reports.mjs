import {escapeHTML as e, pretty, csv, sha256, assert} from './data.mjs';
import {makeZip} from './zip.mjs';

export const label = s => String(s).replace(/_/g, ' ');
const badge = s => `<span class="badge ${e(s)}">${e(label(s))}</span>`;
const list = items => `<ul>${items.map(i => `<li>${e(i)}</li>`).join('')}</ul>`;
const safeLink = url => {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' && !u.username && !u.password ? `<a href="${e(u.href)}" rel="noreferrer">Source reference</a>` : '';
  } catch {
    return '';
  }
};

export function reportTable(headers, rows) {
  return `<div class="table-wrap"><table><thead><tr>${headers.map(h => `<th>${e(h)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(r => `<tr>${r.map(v => `<td>${v}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${headers.length}">No entries in the supplied data. This does not establish complete coverage.</td></tr>`}</tbody></table></div>`;
}

export function reportBody(r) {
  assert(r.kind === 'triage', 'Unsupported report kind');
  return `<h2>Update queue</h2>${reportTable(['Package / lock path', 'Version pair', 'Priority', 'Static references'], r.updates.map(u => [`${e(u.package)}<small>${e(u.path ?? u.dependencyPath ?? 'root manifest')}</small>`, `${e(u.from ?? '?')} → ${e(u.to ?? '?')}`, badge(u.label), e(u.usage.length)]))}${r.updates.map(u => `<article><h2>${e(u.package)} ${badge(u.label)}</h2>${list(u.reasons)}<h3>Static references</h3>${reportTable(['File', 'Line', 'Symbol', 'Kind'], u.usage.map(x => [e(x.path), e(x.line), e(x.symbol), e(x.kind)]))}<h3>Release evidence</h3>${u.evidence.length ? u.evidence.map(x => `<p><strong>${e(x.version)}</strong> · ${e(x.source)} · ${safeLink(x.url)}</p><code class="hash">SHA-256 ${e(x.sha256)}</code>${list(x.statements.map(s => `Line ${s.line} [${s.kind}]: ${s.text}`))}`).join('') : '<p>No applicable release notes supplied.</p>'}<h3>Reviewer checklist</h3>${list(u.checklist)}</article>`).join('')}`;
}

export function renderReport(r) {
  assert(r.kind === 'triage', 'Unsupported report kind');
  const title = 'Dependency upgrade brief';
  const name = r.project;
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'"><title>${e(title)} — Pcnaid</title><style>
:root{font-family:Arial,Helvetica,sans-serif;color:#172434;background:#f4f6fa;font-size:15px;line-height:1.55}body{margin:0}main{max-width:1100px;margin:38px auto;background:#fff;padding:42px;border:1px solid #dbe2eb;border-radius:16px}header{border-bottom:3px solid #003da5;padding-bottom:24px;margin-bottom:30px}.brand{font-size:17px;letter-spacing:.12em;font-weight:800;color:#003da5}h1{font-size:34px;line-height:1.15;margin:16px 0}h2{font-size:22px;margin:30px 0 14px}h3{font-size:17px}p{margin:10px 0}small{display:block;color:#526174;font-size:12px;overflow-wrap:anywhere}code{font-size:12px}.hash{display:block;overflow-wrap:anywhere;color:#526174;margin:8px 0}.notice{background:#edf3fd;border-left:4px solid #003da5;padding:16px 20px;margin:24px 0}.table-wrap{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px;text-align:left}th{background:#f2f5f9;font-size:12px;text-transform:uppercase;letter-spacing:.035em;color:#526174}td,th{padding:13px 12px;border-bottom:1px solid #dbe2eb;vertical-align:top}td{overflow-wrap:anywhere}article{padding:22px 0;border-bottom:1px solid #dbe2eb;break-inside:avoid}.badge{display:inline-block;font-size:11px;line-height:1.3;font-weight:700;text-transform:uppercase;padding:5px 8px;border-radius:4px;background:#eaf0f7;color:#314962;white-space:nowrap}.attention_required,.high,.fail,.migration_required{background:#ffebe8;color:#962d24}.unknown{background:#f1eafb;color:#614087}.medium,.review,.incomplete{background:#fff0d3;color:#7e530c}.documented,.routine,.pass{background:#e2f2e9;color:#225b3d}a{color:#003da5}li{margin:7px 0}footer{border-top:1px solid #dbe2eb;margin-top:30px;padding-top:18px;color:#526174;font-size:12px}@media(max-width:700px){main{margin:0;padding:22px;border:0;border-radius:0}h1{font-size:28px}}@media print{body{background:#fff}main{margin:0;max-width:none;border:0;padding:0}table{font-size:10px}td,th{padding:8px}a{color:inherit}h2{break-after:avoid}.table-wrap{overflow:visible}}
</style></head><body><main><header><div class="brand">PCNAID / DEPENDENCY TRIAGE</div><h1>${e(title)}</h1><p>${e(name)}</p><small>Generated ${e(r.generatedAt)} · Toolkit ${e(r.version)}</small></header><div class="notice">Advisory prioritization only. No repository code was executed, changed, installed, or merged.</div>${reportBody(r)}${r.warnings?.length ? `<h2>Coverage warnings</h2>${list(r.warnings)}` : ''}<h2>Interpretation limits</h2>${list(r.limitations ?? [])}<footer>Pcnaid Inc. · Venture With Confidence.<br>Review this packet for confidential information before sharing. Print from your browser to create a PDF.</footer></main></body></html>`;
}

export function csvReport(r) {
  assert(r.kind === 'triage', 'Unsupported report kind');
  return csv(r.updates.map(u => ({package: u.package, from: u.from, to: u.to, label: u.label, reasons: u.reasons.join(' | '), references: u.usage.length})), ['package', 'from', 'to', 'label', 'reasons', 'references']);
}

export function packet(r, options = {}) {
  const html = renderReport(r);
  const files = {
    'report.html': html,
    'report.json': pretty(r),
    'findings.csv': csvReport(r)
  };
  files['manifest.json'] = pretty({
    format: 'pcnaid-report-packet-v1',
    createdAt: r.generatedAt,
    kind: r.kind,
    files: Object.fromEntries(Object.entries(files).map(([n, v]) => [n, {sha256: sha256(v), bytes: Buffer.byteLength(v)}])),
    warning: 'Unsigned checksum manifest: integrity relative to this manifest, not source authentication.'
  });
  return makeZip(files);
}
