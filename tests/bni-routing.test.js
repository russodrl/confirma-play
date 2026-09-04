import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));

test('rota limpa do BNI UP resolve explicitamente para o index do subdiretório', () => {
  const route = config.rewrites?.find((item) => item.source === '/bni-up-4-setembro');
  assert.deepEqual(route, {
    source: '/bni-up-4-setembro',
    destination: '/bni-up-4-setembro/index.html'
  });
});
