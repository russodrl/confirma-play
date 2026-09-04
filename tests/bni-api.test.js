import test from 'node:test';
import assert from 'node:assert/strict';

process.env.BNI_LIVE_SECRET = 'segredo-de-teste-comprido';
process.env.BNI_PRESENTER_PIN = '482731';

const { default: handler } = await import('../api/bni-live.js');

function responseHarness() {
  return {
    headers: {},
    statusCode: 200,
    payload: null,
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.payload = payload; return this; }
  };
}

test('registra membro oficial e devolve token sem dados de contacto', async () => {
  const req = { method: 'POST', headers: {}, body: { action: 'register', name: 'Amílcar César', company: 'i9Cozinhas', playerId: 'player-12345678' } };
  const res = responseHarness();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.payload.ok, true);
  assert.equal(res.payload.member.slug, 'amilcar-cesar');
  assert.ok(res.payload.token.length > 40);
  const serialized = JSON.stringify(res.payload);
  assert.doesNotMatch(serialized, /"(?:telefone|phone|email|e-mail)"\s*:/i);
  assert.doesNotMatch(serialized, /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i);
});

test('rejeita combinação de nome e empresa inexistente', async () => {
  const req = { method: 'POST', headers: {}, body: { action: 'register', name: 'Amílcar César', company: 'Outra empresa', playerId: 'player-12345678' } };
  const res = responseHarness();
  await handler(req, res);
  assert.equal(res.statusCode, 404);
});

test('rejeita controlo da apresentação sem PIN correto antes de chamar serviços externos', async () => {
  const originalFetch = global.fetch;
  let fetchCalls = 0;
  global.fetch = async () => { fetchCalls += 1; throw new Error('não deveria chamar fetch'); };
  try {
    const req = { method: 'POST', headers: { 'x-presenter-pin': '000000' }, body: { action: 'state', slide: 3, phase: 'presentation' } };
    const res = responseHarness();
    await handler(req, res);
    assert.equal(res.statusCode, 401);
    assert.equal(fetchCalls, 0);
  } finally {
    global.fetch = originalFetch;
  }
});

test('GET sem planilha configurada devolve estado seguro e backend degradado', async () => {
  const keys = ['CONFIRMA_PLAY_SHEETS_ID', 'CONFIRMA_PLAY_SHEETS_CLIENT_ID', 'CONFIRMA_PLAY_SHEETS_CLIENT_SECRET', 'CONFIRMA_PLAY_SHEETS_REFRESH_TOKEN'];
  const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  keys.forEach((key) => { delete process.env[key]; });
  try {
    const req = { method: 'GET', headers: {}, query: {} };
    const res = responseHarness();
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.payload.live, false);
    assert.equal(res.payload.state.gameOpen, false);
    assert.deepEqual(res.payload.ranking, []);
  } finally {
    for (const key of keys) if (saved[key] !== undefined) process.env[key] = saved[key];
  }
});
