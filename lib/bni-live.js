import { createHmac, createHash, timingSafeEqual } from 'node:crypto';

export const DEFAULT_STATE = Object.freeze({
  slide: 0,
  phase: 'lobby',
  gameOpen: false,
  version: 0,
  updatedAt: null
});

const PHASES = new Set(['lobby', 'presentation', 'personalized', 'game', 'podium']);
const MAX_SLIDE = 16;
const TOKEN_TTL_MS = 86_400_000;

export function createAsyncTtlCache(loader, ttlMs, now = Date.now, staleIfErrorMs = 0) {
  let value;
  let loadedAt = -Infinity;
  let inFlight = null;

  async function cached(...args) {
    if (value !== undefined && now() - loadedAt < ttlMs) return value;
    if (inFlight) return inFlight;
    inFlight = Promise.resolve(loader(...args))
      .then((next) => {
        value = next;
        loadedAt = now();
        return next;
      })
      .catch((error) => {
        if (value !== undefined && now() - loadedAt <= ttlMs + staleIfErrorMs) return value;
        throw error;
      })
      .finally(() => { inFlight = null; });
    return inFlight;
  }

  cached.set = (next) => {
    value = next;
    loadedAt = now();
  };
  cached.clear = () => {
    value = undefined;
    loadedAt = -Infinity;
  };
  return cached;
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function normalizeState(patch, current = DEFAULT_STATE, now = new Date().toISOString()) {
  const slide = Number(patch?.slide ?? current.slide);
  const phase = String(patch?.phase ?? current.phase);
  const gameOpen = patch?.gameOpen === undefined ? Boolean(current.gameOpen) : patch.gameOpen === true;
  if (!Number.isInteger(slide) || slide < 0 || slide > MAX_SLIDE || !PHASES.has(phase)) {
    throw new TypeError('Estado de apresentação inválido');
  }
  return {
    slide,
    phase,
    gameOpen,
    version: Number(current.version || 0) + 1,
    updatedAt: now
  };
}

export function verifyPresenterPin(input, expectedPin) {
  if (!input || !expectedPin) return false;
  const digest = (value) => createHash('sha256').update(String(value)).digest();
  return timingSafeEqual(digest(input), digest(expectedPin));
}

function sign(encodedPayload, secret) {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url');
}

export function issueParticipantToken(memberSlug, playerId, secret, issuedAt = Date.now()) {
  if (!secret || !memberSlug || !playerId) throw new TypeError('Dados de sessão incompletos');
  const payload = Buffer.from(JSON.stringify({ memberSlug, playerId, issuedAt })).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyParticipantToken(token, secret, now = Date.now()) {
  try {
    if (!token || !secret) return null;
    const [payload, signature, extra] = String(token).split('.');
    if (!payload || !signature || extra || !safeEqual(signature, sign(payload, secret))) return null;
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!decoded.memberSlug || !decoded.playerId || !Number.isFinite(decoded.issuedAt)) return null;
    if (now < decoded.issuedAt || now - decoded.issuedAt > TOKEN_TTL_MS) return null;
    return { memberSlug: decoded.memberSlug, playerId: decoded.playerId };
  } catch {
    return null;
  }
}

export function normalizeScore(input) {
  const score = Number(input?.score);
  const durationMs = Number(input?.durationMs);
  const correctAnswers = Number(input?.correctAnswers);
  if (!Number.isInteger(score) || score < 0 || score > 100_000
    || !Number.isInteger(durationMs) || durationMs < 1_000 || durationMs > 600_000
    || !Number.isInteger(correctAnswers) || correctAnswers < 0 || correctAnswers > 8) {
    throw new TypeError('Pontuação inválida');
  }
  return { score, durationMs, correctAnswers };
}

export function rankScores(entries, limit = 30) {
  const bestByPlayer = new Map();
  for (const entry of entries || []) {
    if (!entry?.playerId || !Number.isFinite(Number(entry.score)) || !Number.isFinite(Number(entry.durationMs))) continue;
    const normalized = { ...entry, score: Number(entry.score), durationMs: Number(entry.durationMs) };
    const current = bestByPlayer.get(entry.playerId);
    if (!current || normalized.score > current.score
      || (normalized.score === current.score && normalized.durationMs < current.durationMs)) {
      bestByPlayer.set(entry.playerId, normalized);
    }
  }
  return [...bestByPlayer.values()]
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs || String(a.createdAt).localeCompare(String(b.createdAt)))
    .slice(0, limit)
    .map((entry, index) => ({ ...entry, position: index + 1 }));
}
