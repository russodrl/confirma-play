import { createHash, randomUUID } from 'node:crypto';
import { clean, sanitizeQuote, validateQuote } from '../lib/quote.js';

const recent = new Map();

const SHEET_TAB = process.env.CONFIRMA_PLAY_SHEETS_TAB || 'Cotações';
const HEADERS = [
  'ID', 'Recebido em', 'Nome', 'WhatsApp', 'E-mail', 'Tipo de evento', 'Data do evento',
  'Convidados', 'Recursos', 'Tema/estilo', 'Observações',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'Referrer', 'Landing page'
];

function clientIp(req) {
  return clean(req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'visitante', 120);
}

// A planilha do Confirma Play é obrigatoriamente a dela. Sem fallback para
// GOOGLE_SHEETS_ID: uma variável faltando escreveria lead comercial dentro da
// planilha da festa do Nick, e um vazamento desses não avisa que aconteceu.
function spreadsheetId() {
  return process.env.CONFIRMA_PLAY_SHEETS_ID;
}

// As credenciais, ao contrário da planilha, podem ser as mesmas: é o mesmo app
// OAuth acessando duas planilhas distintas. Quem quiser separar também as
// credenciais define as CONFIRMA_PLAY_* e nada mais precisa mudar.
function googleCredential(name) {
  return process.env[`CONFIRMA_PLAY_SHEETS_${name}`] || process.env[`GOOGLE_SHEETS_${name}`];
}

function googleSheetsConfigured() {
  return ['CLIENT_ID', 'CLIENT_SECRET', 'REFRESH_TOKEN'].every((key) => Boolean(googleCredential(key)))
    && Boolean(spreadsheetId());
}

async function googleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: googleCredential('CLIENT_ID'),
      client_secret: googleCredential('CLIENT_SECRET'),
      refresh_token: googleCredential('REFRESH_TOKEN'),
      grant_type: 'refresh_token'
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error('Não foi possível autenticar a planilha');
  return payload.access_token;
}

// A aba pode não existir ainda: o append falha contra aba inexistente, então criamos
// com o cabeçalho na primeira gravação em vez de exigir um passo manual no Sheets.
async function ensureTab(sheetId, authHeaders) {
  const metaResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}?fields=sheets.properties.title`,
    { headers: authHeaders }
  );
  const meta = await metaResponse.json();
  if (!metaResponse.ok) throw new Error('Não foi possível ler a estrutura da planilha');
  if ((meta.sheets || []).some((sheet) => sheet.properties?.title === SHEET_TAB)) return;

  const createResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${sheetId}:batchUpdate`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requests: [{ addSheet: { properties: { title: SHEET_TAB } } }] })
  });
  if (!createResponse.ok) throw new Error(`Não foi possível criar a aba ${SHEET_TAB}`);

  const headerRange = encodeURIComponent(`'${SHEET_TAB}'!A1`);
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${headerRange}?valueInputOption=RAW`,
    {
      method: 'PUT',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [HEADERS] })
    }
  );
}

async function persistSpreadsheet(record) {
  if (!googleSheetsConfigured()) return { saved: false, skipped: true };
  const sheetId = spreadsheetId();
  const accessToken = await googleAccessToken();
  const authHeaders = { Authorization: `Bearer ${accessToken}` };
  await ensureTab(sheetId, authHeaders);

  const q = record.quote;
  const a = q.attribution;
  const row = [
    record.id,
    record.createdAt,
    q.name,
    q.phone,
    q.email,
    q.eventType,
    q.eventDate.split('-').reverse().join('/'),
    q.guests,
    q.features.join(', '),
    q.theme,
    q.notes,
    a.utmSource, a.utmMedium, a.utmCampaign, a.utmContent, a.referrer, a.landingPage
  ];

  const appendRange = encodeURIComponent(`'${SHEET_TAB}'!A:Q`);
  const appendResponse = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${appendRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [row] })
    }
  );
  const appendPayload = await appendResponse.json();
  if (!appendResponse.ok || Number(appendPayload.updates?.updatedRows) !== 1) {
    throw new Error('Não foi possível gravar a cotação na planilha');
  }
  return { saved: true, updatedRange: appendPayload.updates?.updatedRange || null };
}

async function notifyTelegram(record) {
  const token = process.env.CONFIRMA_PLAY_TELEGRAM_BOT_TOKEN;
  const chatId = process.env.CONFIRMA_PLAY_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return { sent: false, skipped: true };

  const q = record.quote;
  const text = [
    '🎉 Nova cotação Confirma Play',
    '',
    `Nome: ${q.name}`,
    `WhatsApp: ${q.phone}`,
    ...(q.email ? [`E-mail: ${q.email}`] : []),
    `Evento: ${q.eventType}`,
    `Data: ${q.eventDate.split('-').reverse().join('/')}`,
    `Convidados: ${q.guests}`,
    `Recursos: ${q.features.join(', ')}`,
    ...(q.theme ? [`Tema/estilo: ${q.theme}`] : []),
    ...(q.notes ? [`Observações: ${q.notes}`] : []),
    '',
    `ID: ${record.id}`,
    ...(record.saved ? [] : ['', '⚠️ Esta cotação NÃO entrou na planilha. Os dados deste aviso são a única cópia.'])
  ].join('\n');

  const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true })
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error('Telegram recusou a notificação');
  return { sent: true, messageId: payload.result?.message_id || null };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }

  if (!googleSheetsConfigured()) {
    return res.status(503).json({ error: 'Cotação temporariamente indisponível' });
  }

  const quote = sanitizeQuote(req.body);
  const errors = validateQuote(quote);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revise os campos indicados', fields: errors });

  const qaSecret = clean(req.headers['x-confirma-qa-secret'], 200);
  const qaHash = createHash('sha256').update(qaSecret).digest('hex');
  const expectedQaSecret = process.env.CONFIRMA_PLAY_QA_SECRET || process.env.QUOTE_HASH_SECRET || '';
  const expectedQaHash = createHash('sha256').update(expectedQaSecret).digest('hex');
  const isQa = Boolean(qaSecret) && qaHash === expectedQaHash;
  const persistQa = isQa && clean(req.headers['x-confirma-qa-persist'], 10) === '1';

  const ip = clientIp(req);
  const now = Date.now();
  if (!isQa) {
    if (now - (recent.get(ip) || 0) < 60_000) return res.status(429).json({ error: 'Aguarde um minuto antes de enviar novamente' });
    recent.set(ip, now);
  }

  const createdAt = new Date().toISOString();
  const id = `CP-${createdAt.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const record = { version: 2, id, createdAt, quote };

  // Planilha e Telegram são independentes: uma falha isolada não pode fazer o lead sumir.
  // QA comum não persiste. O smoke test assinado pode persistir na planilha, mas
  // nunca dispara Telegram, para que todo dado sintético possa ser removido.
  let storage = { saved: false };
  try {
    storage = isQa && !persistQa ? { saved: false, dryRun: true } : await persistSpreadsheet(record);
  } catch (error) {
    // Sem este log o erro real some e o 502 vira indiagnosticável, como no Blob.
    console.error('[quote] falha ao gravar na planilha', { id, tab: SHEET_TAB, message: error?.message });
    storage = { saved: false, error: error?.message || 'erro desconhecido' };
  }
  record.saved = storage.saved;

  let notification = { sent: false };
  if (isQa) {
    notification = { sent: false, skipped: true, qa: true };
  } else {
    try {
      notification = await notifyTelegram(record);
    } catch (error) {
      console.error('[quote] falha ao notificar no Telegram', { id, message: error?.message });
      notification = { sent: false, failed: true };
    }
  }

  if (isQa) {
    if (persistQa && !storage.saved) {
      return res.status(502).json({ error: 'Não foi possível registrar o pedido sintético.' });
    }
    return res.status(200).json({
      ok: true,
      dryRun: !persistQa,
      syntheticPersisted: persistQa,
      id: persistQa ? id : undefined,
      validatedFields: Object.keys(quote).length,
      saved: storage.saved,
      notificationSent: false
    });
  }

  if (!storage.saved && !notification.sent) {
    return res.status(502).json({ error: 'Não foi possível registrar a cotação. Tente novamente.' });
  }

  return res.status(201).json({ ok: true, id, saved: storage.saved, notificationSent: notification.sent });
}
