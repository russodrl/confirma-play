import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../public/nick-7meses/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const app = await readFile(new URL('app.js', root), 'utf8');
const sw = await readFile(new URL('sw.js', root), 'utf8');
const manifest = JSON.parse(await readFile(new URL('manifest.webmanifest', root), 'utf8'));

async function walk(path) {
  const entries = await readdir(path);
  const files = [];
  for (const entry of entries) {
    const child = join(path, entry);
    if ((await stat(child)).isDirectory()) files.push(...await walk(child));
    else files.push(child);
  }
  return files;
}

test('Nick page uses the Confirma Play subpath for static resources', () => {
  assert.match(html, /href="\/nick-7meses\/styles\.css"/);
  assert.match(html, /src="\/nick-7meses\/app\.js"/);
  assert.match(html, /https:\/\/confirma-play\.com\/nick-7meses\/assets\/convite-nicolas\.png/);
  assert.doesNotMatch(html, /(?:src|href)="\/(?:assets|styles\.css|app\.js|manifest\.webmanifest)/);
});

test('Nick browser APIs and dynamic assets stay inside the subpath', () => {
  assert.match(app, /fetch\('\/nick-7meses\/api\/rsvp'/);
  assert.match(app, /navigator\.serviceWorker\.register\('\/nick-7meses\/sw\.js'/);
  assert.match(app, /\/nick-7meses\/assets\/game\/nick-run\.png/);
  assert.doesNotMatch(app, /['"`]\/(?:api|assets)\//);
});

test('Nick PWA scope and notification targets use the subpath', () => {
  assert.equal(manifest.start_url, '/nick-7meses/#inicio');
  assert.equal(manifest.scope, '/nick-7meses/');
  assert.match(sw, /\/nick-7meses\/#eventDetails/);
});

test('Nick asset copy is complete enough for the experience', async () => {
  const files = await walk(fileURLToPath(root));
  assert.ok(files.length >= 140, `expected at least 140 files, found ${files.length}`);
  for (const relative of [
    'assets/convite-nicolas.png',
    'assets/game/nick-run.png',
    'assets/game/walk-frames/walk-21.png',
    'assets/music/sete-meses-de-alegria-1.mp3',
    'assets/icons/icon-192.png'
  ]) {
    const info = await stat(new URL(relative, root));
    assert.ok(info.size > 1000, `${relative} is unexpectedly small`);
  }
});
