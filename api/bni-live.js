import { DEFAULT_STATE, issueParticipantToken, normalizeScore, normalizeState, rankScores, verifyParticipantToken, verifyPresenterPin } from '../lib/bni-live.js';
import { findMember, publicMember } from '../lib/bni-members.js';

const STATE_TAB = 'BNI Live';
const RANKING_TAB = 'BNI Ranking';
const stateHeaders = ['Slide', 'Fase', 'Jogo liberado', 'Versão', 'Atualizado em'];
const rankingHeaders = ['Player ID', 'Membro', 'Nome', 'Empresa', 'Pontos', 'Duração ms', 'Respostas certas', 'Criado em'];
const recentScores = new Map();

function configured() {
  return Boolean(process.env.CONFIRMA_PLAY_SHEETS_ID
    && process.env.CONFIRMA_PLAY_SHEETS_CLIENT_ID
    && process.env.CONFIRMA_PLAY_SHEETS_CLIENT_SECRET
    && process.env.CONFIRMA_PLAY_SHEETS_REFRESH_TOKEN);
}

async function accessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.CONFIRMA_PLAY_SHEETS_CLIENT_ID,
      client_secret: process.env.CONFIRMA_PLAY_SHEETS_CLIENT_SECRET,
      refresh_token: process.env.CONFIRMA_PLAY_SHEETS_REFRESH_TOKEN,
      grant_type: 'refresh_token'
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error('Falha ao autenticar armazenamento BNI');
  return payload.access_token;
}

function sheetUrl(path) {
  return `https://sheets.googleapis.com/v4/spreadsheets/${process.env.CONFIRMA_PLAY_SHEETS_ID}${path}`;
}

async function sheetRequest(path, token, options = {}) {
  const response = await fetch(sheetUrl(path), {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'Falha no armazenamento BNI');
  return payload;
}

async function ensureTabs(token) {
  const meta = await sheetRequest('?fields=sheets.properties.title', token);
  const existing = new Set((meta.sheets || []).map((sheet) => sheet.properties?.title));
  const missing = [STATE_TAB, RANKING_TAB].filter((title) => !existing.has(title));
  if (missing.length) {
    await sheetRequest(':batchUpdate', token, {
      method: 'POST',
      body: JSON.stringify({ requests: missing.map((title) => ({ addSheet: { properties: { title } } })) })
    });
  }
  const updates = [];
  if (missing.includes(STATE_TAB)) updates.push({ range: `'${STATE_TAB}'!A1:E2`, values: [stateHeaders, [0, 'lobby', false, 0, '']] });
  if (missing.includes(RANKING_TAB)) updates.push({ range: `'${RANKING_TAB}'!A1:H1`, values: [rankingHeaders] });
  if (updates.length) {
    await sheetRequest('/values:batchUpdate', token, {
      method: 'POST',
      body: JSON.stringify({ valueInputOption: 'RAW', data: updates })
    });
  }
}

function parseState(row = []) {
  if (!row.length) return { ...DEFAULT_STATE };
  const slide = Number(row[0]);
  const phase = String(row[1] || 'lobby');
  const gameOpen = row[2] === true || String(row[2]).toLowerCase() === 'true';
  const version = Number(row[3] || 0);
  const updatedAt = row[4] || null;
  try {
    const checked = normalizeState({ slide, phase, gameOpen }, { ...DEFAULT_STATE, version: Math.max(-1, version - 1) }, updatedAt || new Date(0).toISOString());
    return { ...checked, version, updatedAt };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function parseScores(rows = []) {
  return rows.map((row) => ({
    playerId: String(row[0] || ''),
    memberSlug: String(row[1] || ''),
    name: String(row[2] || ''),
    company: String(row[3] || ''),
    score: Number(row[4] || 0),
    durationMs: Number(row[5] || 0),
    correctAnswers: Number(row[6] || 0),
    createdAt: String(row[7] || '')
  })).filter((entry) => entry.playerId && entry.name);
}

async function readSnapshot(token) {
  const params = new URLSearchParams();
  params.append('ranges', `'${STATE_TAB}'!A2:E2`);
  params.append('ranges', `'${RANKING_TAB}'!A2:H1000`);
  params.set('majorDimension', 'ROWS');
  const payload = await sheetRequest(`/values:batchGet?${params}`, token);
  const [stateRange, rankingRange] = payload.valueRanges || [];
  return {
    state: parseState(stateRange?.values?.[0]),
    ranking: rankScores(parseScores(rankingRange?.values || []))
  };
}

async function writeState(token, state) {
  const range = encodeURIComponent(`'${STATE_TAB}'!A2:E2`);
  await sheetRequest(`/values/${range}?valueInputOption=RAW`, token, {
    method: 'PUT',
    body: JSON.stringify({ values: [[state.slide, state.phase, state.gameOpen, state.version, state.updatedAt]] })
  });
}

async function appendScore(token, entry) {
  const range = encodeURIComponent(`'${RANKING_TAB}'!A:H`);
  await sheetRequest(`/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, token, {
    method: 'POST',
    body: JSON.stringify({ values: [[entry.playerId, entry.memberSlug, entry.name, entry.company, entry.score, entry.durationMs, entry.correctAnswers, entry.createdAt]] })
  });
}

async function resetLive(token) {
  await sheetRequest('/values:batchClear', token, {
    method: 'POST',
    body: JSON.stringify({ ranges: [`'${RANKING_TAB}'!A2:H1000`] })
  });
  await writeState(token, { ...DEFAULT_STATE, updatedAt: new Date().toISOString() });
}

function bodyOf(req) {
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return {}; }
  }
  return req.body || {};
}

function participantSecret() {
  return process.env.BNI_LIVE_SECRET || process.env.CONFIRMA_PLAY_QA_SECRET || process.env.QUOTE_HASH_SECRET || '';
}

export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  const body = bodyOf(req);

  if (req.method === 'GET') {
    if (!configured()) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ ok: true, live: false, state: { ...DEFAULT_STATE }, ranking: [] });
    }
    try {
      const token = await accessToken();
      await ensureTabs(token);
      const snapshot = await readSnapshot(token);
      res.setHeader('Cache-Control', 'public, s-maxage=1, stale-while-revalidate=3');
      return res.status(200).json({ ok: true, live: true, ...snapshot });
    } catch (error) {
      console.error('[bni-live] snapshot', { message: error?.message });
      return res.status(503).json({ error: 'Sincronização temporariamente indisponível' });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ error: 'Método não permitido' });
  }
  res.setHeader('Cache-Control', 'no-store');

  if (body.action === 'register') {
    const playerId = String(body.playerId || '');
    const member = findMember(body.name, body.company);
    if (!member || !/^[A-Za-z0-9_-]{8,64}$/.test(playerId)) return res.status(404).json({ error: 'Nome e empresa não correspondem à base do BNI UP' });
    const secret = participantSecret();
    if (!secret) return res.status(503).json({ error: 'Sessões ainda não configuradas' });
    return res.status(200).json({ ok: true, member: publicMember(member), token: issueParticipantToken(member.slug, playerId, secret) });
  }

  if (body.action === 'state' || body.action === 'reset') {
    const pin = req.headers?.['x-presenter-pin'] || body.pin;
    if (!verifyPresenterPin(pin, process.env.BNI_PRESENTER_PIN)) return res.status(401).json({ error: 'PIN inválido' });
    if (!configured()) return res.status(503).json({ error: 'Armazenamento ainda não configurado' });
    try {
      const token = await accessToken();
      await ensureTabs(token);
      if (body.action === 'reset') {
        await resetLive(token);
        return res.status(200).json({ ok: true, state: { ...DEFAULT_STATE } });
      }
      const snapshot = await readSnapshot(token);
      const state = normalizeState(body, snapshot.state);
      await writeState(token, state);
      return res.status(200).json({ ok: true, state });
    } catch (error) {
      console.error('[bni-live] presenter', { message: error?.message });
      return res.status(503).json({ error: 'Não foi possível atualizar a apresentação' });
    }
  }

  if (body.action === 'score') {
    if (!configured()) return res.status(503).json({ error: 'Ranking ainda não configurado' });
    const bearer = String(req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
    const session = verifyParticipantToken(bearer || body.token, participantSecret());
    if (!session) return res.status(401).json({ error: 'Sessão de jogador inválida' });
    const member = findMember(body.name, body.company);
    if (!member || member.slug !== session.memberSlug) return res.status(403).json({ error: 'Jogador não corresponde ao membro autenticado' });
    const now = Date.now();
    if (now - (recentScores.get(session.playerId) || 0) < 10_000) return res.status(429).json({ error: 'Aguarde antes de enviar outra pontuação' });
    let normalized;
    try { normalized = normalizeScore(body); } catch { return res.status(400).json({ error: 'Pontuação inválida' }); }
    try {
      const token = await accessToken();
      await ensureTabs(token);
      const snapshot = await readSnapshot(token);
      if (!snapshot.state.gameOpen) return res.status(403).json({ error: 'O jogo ainda não foi liberado pelo apresentador' });
      const entry = { ...normalized, playerId: session.playerId, memberSlug: member.slug, name: member.name, company: member.company, createdAt: new Date().toISOString() };
      await appendScore(token, entry);
      recentScores.set(session.playerId, now);
      return res.status(201).json({ ok: true, entry });
    } catch (error) {
      console.error('[bni-live] score', { message: error?.message });
      return res.status(503).json({ error: 'Não foi possível registrar a pontuação' });
    }
  }

  return res.status(400).json({ error: 'Ação desconhecida' });
}
