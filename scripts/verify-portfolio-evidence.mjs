import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const expected = {
  'docs/portfolio/media/02b-focus-mode-audit-desktop.png': 'adee00688a3fa5d36c9df79fcf5d544bbe61241d4b7014df1c2313c31edbb3db',
  'docs/portfolio/media/03-reloadable-history-desktop.png': '4baab9b7efe8a86682fb00c686b0b38d08b8acfa1a4626149c71b666eab67cc9',
  'docs/portfolio/media/04-confirmed-crm-desktop.png': 'd532856908a3c0641d2050818d72ee5025d7473a2766f9530f23f22a7d18a3f7',
};

const readme = await readFile(join(repo, 'README.md'), 'utf8');
for (const [path, sha256] of Object.entries(expected)) {
  const img = await readFile(join(repo, path));
  assert.ok(img.length > 40_000, `${path}: expected authentic full-resolution screenshot`);
  assert.equal(img.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${path}: PNG signature mismatch`);
  assert.equal(createHash('sha256').update(img).digest('hex'), sha256, `${path}: reviewed CI screenshot changed`);
  assert.ok(readme.includes(`(${path})`), `${path}: image missing from README`);
  console.log(`PASS authentic screenshot: ${path}`);
}

const provenance = await readFile(join(repo, 'docs/portfolio/ASSET_PROVENANCE.md'), 'utf8');
for (const sha of Object.values(expected)) {
  assert.ok(provenance.includes(sha), `Missing SHA-256 provenance for ${sha}`);
}
console.log('PASS screenshot provenance manifest');

const lock = JSON.parse(await readFile(join(repo, 'package-lock.json'), 'utf8'));
assert.equal(lock.lockfileVersion, 3, 'Review lockfile parser for new lockfile version');
const deps = Object.entries(lock.packages).filter(([path]) => path !== '');
assert.ok(deps.length > 0, 'Expected locked dependencies');
const withoutLicense = deps.filter(([path, pkg]) => !pkg.license).map(([path]) => path);
assert.deepEqual(withoutLicense, [], 'Every locked dependency needs a license field for review');
const licenses = new Map();
for (const [, pkg] of deps) {
  licenses.set(pkg.license, (licenses.get(pkg.license) || 0) + 1);
}
assert.ok(licenses.has('MIT') && licenses.has('Apache-2.0'));
console.log(`PASS lockfile SPDX license metadata: ${deps.length} entries, ${licenses.size} expressions`);
console.log('Reminder: SPDX metadata check is not license compliance or secret-history clearance');
console.log('PORTFOLIO_EVIDENCE_GATE_PASS');
