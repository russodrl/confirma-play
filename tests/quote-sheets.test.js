import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.GOOGLE_SHEETS_CLIENT_ID = 'cid';
process.env.GOOGLE_SHEETS_CLIENT_SECRET = 'secret';
process.env.GOOGLE_SHEETS_REFRESH_TOKEN = 'refresh';
process.env.CONFIRMA_PLAY_SHEETS_ID = 'cotacoes-confirma-play';
process.env.CONFIRMA_PLAY_TELEGRAM_BOT_TOKEN = 'bot';
process.env.CONFIRMA_PLAY_TELEGRAM_CHAT_ID = '42';
process.env.QUOTE_HASH_SECRET = 'qa-secret';

const { default: handler } = await import('../api/quote.js');

const VALID_BODY = {
  name: 'Maria Souza',
  phone: '+55 11 99999-8888',
  email: 'MARIA@Exemplo.com',
  eventType: 'Aniversário infantil',
  eventDate: '2027-03-14',
  guests: 60,
  features: ['Confirmação de presença', 'Convite digital personalizado'],
  theme: 'Jardim encantado',
  notes: 'Festa à tarde',
  consent: true,
  attribution: { utmSource: 'instagram', utmCampaign: 'lancamento' }
};

function makeRes() {
  const res = { statusCode: null, body: null, headers: {} };
  res.setHeader = (k, v) => { res.headers[k] = v; };
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (payload) => { res.body = payload; return res; };
  return res;
}

// Cada teste usa um IP distinto: o limitador de 60s é por IP e em memória de módulo.
function makeReq(ip, body = VALID_BODY) {
  return { method: 'POST', headers: { 'x-forwarded-for': ip }, body };
}

function stubFetch({ tabExists = true, appendOk = true, telegramOk = true } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init = {}) => {
    calls.push({ url: String(url), init });
    const u = String(url);
    if (u.startsWith('https://oauth2.googleapis.com/token')) {
      return { ok: true, json: async () => ({ access_token: 'token-abc' }) };
    }
    if (u.includes('fields=sheets.properties.title')) {
      return { ok: true, json: async () => ({ sheets: tabExists ? [{ properties: { title: 'Cotações' } }] : [] }) };
    }
    if (u.includes(':batchUpdate')) return { ok: true, json: async () => ({}) };
    if (u.includes(':append')) {
      return appendOk
        ? { ok: true, json: async () => ({ updates: { updatedRows: 1, updatedRange: "'Cotações'!A2:Q2" } }) }
        : { ok: false, json: async () => ({ error: { message: 'PERMISSION_DENIED' } }) };
    }
    if (u.includes('api.telegram.org')) {
      return telegramOk
        ? { ok: true, json: async () => ({ ok: true, result: { message_id: 7 } }) }
        : { ok: false, json: async () => ({ ok: false }) };
    }
    if (u.includes('/values/')) return { ok: true, json: async () => ({}) };
    throw new Error(`URL inesperada: ${u}`);
  };
  return calls;
}

test('grava a cotação na planilha e responde 201', async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq('10.0.0.1'), res);

  assert.equal(res.statusCode, 201);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.saved, true);
  assert.equal(res.body.notificationSent, true);
  assert.match(res.body.id, /^CP-\d{8}-[0-9A-F]{8}$/);

  const append = calls.find((c) => c.url.includes(':append'));
  const [row] = JSON.parse(append.init.body).values;
  assert.equal(row[0], res.body.id);
  assert.equal(row[2], 'Maria Souza');
  assert.equal(row[3], '+55 11 99999-8888');
  assert.equal(row[4], 'maria@exemplo.com');
  assert.equal(row[6], '14/03/2027', 'a data vai para a planilha em formato BR');
  assert.equal(row[7], 60);
  assert.equal(row[8], 'Confirmação de presença, Convite digital personalizado');
  assert.equal(row[11], 'instagram');
  assert.equal(row.length, 17, 'a linha tem uma coluna por cabeçalho');
});

test('cria a aba com cabeçalho quando ela ainda não existe', async () => {
  const calls = stubFetch({ tabExists: false });
  const res = makeRes();
  await handler(makeReq('10.0.0.2'), res);

  assert.equal(res.statusCode, 201);
  const created = calls.find((c) => c.url.includes(':batchUpdate'));
  assert.ok(created, 'a aba ausente é criada antes do append');
  assert.equal(JSON.parse(created.init.body).requests[0].addSheet.properties.title, 'Cotações');
});

test('planilha fora do ar ainda notifica o lead no Telegram', async () => {
  const calls = stubFetch({ appendOk: false });
  const res = makeRes();
  await handler(makeReq('10.0.0.3'), res);

  assert.equal(res.statusCode, 201, 'o lead não se perde por causa da planilha');
  assert.equal(res.body.saved, false);
  assert.equal(res.body.notificationSent, true);

  const telegram = calls.find((c) => c.url.includes('api.telegram.org'));
  assert.match(JSON.parse(telegram.init.body).text, /NÃO entrou na planilha/);
});

test('502 apenas quando planilha e Telegram falham juntos', async () => {
  stubFetch({ appendOk: false, telegramOk: false });
  const res = makeRes();
  await handler(makeReq('10.0.0.4'), res);

  assert.equal(res.statusCode, 502);
  assert.match(res.body.error, /Não foi possível registrar a cotação/);
});

test('smoke test assinado persiste na planilha sem notificar o Telegram', async () => {
  const calls = stubFetch();
  const req = makeReq('10.0.0.9');
  req.headers['x-confirma-qa-secret'] = 'qa-secret';
  req.headers['x-confirma-qa-persist'] = '1';
  const res = makeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.syntheticPersisted, true);
  assert.equal(res.body.saved, true);
  assert.match(res.body.id, /^CP-\d{8}-[0-9A-F]{8}$/);
  assert.ok(calls.some((call) => call.url.includes(':append')));
  assert.equal(calls.some((call) => call.url.includes('api.telegram.org')), false);
});

test('dry run assinado não persiste nem notifica', async () => {
  const calls = stubFetch();
  const req = makeReq('10.0.0.10');
  req.headers['x-confirma-qa-secret'] = 'qa-secret';
  const res = makeRes();
  await handler(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body.dryRun, true);
  assert.equal(res.body.syntheticPersisted, false);
  assert.equal(res.body.saved, false);
  assert.equal(calls.length, 0);
});

test('campo inválido responde 400 sem tocar na planilha', async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq('10.0.0.5', { ...VALID_BODY, consent: false }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(res.body.fields.consent, 'Confirme que podemos entrar em contato');
  assert.equal(calls.length, 0);
});

test('honeypot preenchido é recusado', async () => {
  const calls = stubFetch();
  const res = makeRes();
  await handler(makeReq('10.0.0.6', { ...VALID_BODY, website: 'http://spam.example' }), res);

  assert.equal(res.statusCode, 400);
  assert.equal(calls.length, 0);
});

test('segundo envio do mesmo IP em menos de um minuto é barrado', async () => {
  stubFetch();
  const first = makeRes();
  await handler(makeReq('10.0.0.7'), first);
  assert.equal(first.statusCode, 201);

  const second = makeRes();
  await handler(makeReq('10.0.0.7'), second);
  assert.equal(second.statusCode, 429);
});

test('recusa gravar quando a planilha do Confirma Play não está configurada', async () => {
  const calls = stubFetch();
  const saved = process.env.CONFIRMA_PLAY_SHEETS_ID;
  // A planilha do Nick presente não pode servir de substituta: sem a do Confirma
  // Play a API tem de recusar, nunca cair na planilha do outro projeto.
  delete process.env.CONFIRMA_PLAY_SHEETS_ID;
  process.env.GOOGLE_SHEETS_ID = 'planilha-do-nick';
  try {
    const res = makeRes();
    await handler(makeReq('10.0.0.8'), res);
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0, 'nenhuma chamada ao Google sem planilha própria');
  } finally {
    delete process.env.GOOGLE_SHEETS_ID;
    process.env.CONFIRMA_PLAY_SHEETS_ID = saved;
  }
});
