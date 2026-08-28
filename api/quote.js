import { createHash, randomUUID } from 'node:crypto';
import { put } from '@vercel/blob';
import { clean, sanitizeQuote, validateQuote } from '../lib/quote.js';

const recent = new Map();

function clientIp(req) {
  return clean(req.headers['x-forwarded-for']?.split(',')[0] || req.headers['x-real-ip'] || 'visitante', 120);
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
    `ID: ${record.id}`
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

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return res.status(503).json({ error: 'Cotação temporariamente indisponível' });
  }

  const quote = sanitizeQuote(req.body);
  const errors = validateQuote(quote);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Revise os campos indicados', fields: errors });

  const ip = clientIp(req);
  const now = Date.now();
  if (now - (recent.get(ip) || 0) < 60_000) return res.status(429).json({ error: 'Aguarde um minuto antes de enviar novamente' });
  recent.set(ip, now);

  const createdAt = new Date().toISOString();
  const id = `CP-${createdAt.slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
  const ipHash = createHash('sha256').update(`${process.env.QUOTE_HASH_SECRET || 'confirma-play'}:${ip}`).digest('hex');
  const record = { version: 1, id, createdAt, ipHash, quote };
  const pathname = `confirma-play/quotes/${createdAt.slice(0, 7)}/${id}.json`;

  try {
    await put(pathname, JSON.stringify(record), {
      access: 'private',
      allowOverwrite: false,
      contentType: 'application/json',
      cacheControlMaxAge: 0
    });
  } catch {
    return res.status(502).json({ error: 'Não foi possível registrar a cotação. Tente novamente.' });
  }

  let notification = { sent: false };
  try {
    notification = await notifyTelegram(record);
  } catch {
    notification = { sent: false, failed: true };
  }

  return res.status(201).json({ ok: true, id, notificationSent: notification.sent });
}
