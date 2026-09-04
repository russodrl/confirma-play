import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_STATE,
  normalizeState,
  verifyPresenterPin,
  issueParticipantToken,
  verifyParticipantToken,
  normalizeScore,
  rankScores
} from '../lib/bni-live.js';

test('estado padrão mantém participantes no lobby com jogo bloqueado', () => {
  assert.deepEqual(DEFAULT_STATE, {
    slide: 0,
    phase: 'lobby',
    gameOpen: false,
    version: 0,
    updatedAt: null
  });
});

test('estado aceita somente slides e fases conhecidas', () => {
  const next = normalizeState({ slide: 4, phase: 'personalized', gameOpen: false }, DEFAULT_STATE, '2026-09-04T07:30:00.000Z');
  assert.equal(next.slide, 4);
  assert.equal(next.phase, 'personalized');
  assert.equal(next.gameOpen, false);
  assert.equal(next.version, 1);
  assert.equal(next.updatedAt, '2026-09-04T07:30:00.000Z');
  assert.throws(() => normalizeState({ slide: 999, phase: 'hack' }, DEFAULT_STATE));
});

test('PIN do apresentador usa comparação por hash', () => {
  assert.equal(verifyPresenterPin('482731', '482731'), true);
  assert.equal(verifyPresenterPin('482730', '482731'), false);
  assert.equal(verifyPresenterPin('', '482731'), false);
});

test('token vincula participante ao membro e expira', () => {
  const secret = 'segredo-de-teste-comprido';
  const issuedAt = 1_000_000;
  const token = issueParticipantToken('aleksander-russo', 'player-12345678', secret, issuedAt);
  assert.deepEqual(verifyParticipantToken(token, secret, issuedAt + 60_000), {
    memberSlug: 'aleksander-russo',
    playerId: 'player-12345678'
  });
  assert.equal(verifyParticipantToken(token, secret, issuedAt + 86_400_001), null);
  assert.equal(verifyParticipantToken(`${token}x`, secret, issuedAt + 1), null);
});

test('pontuação rejeita valores impossíveis e normaliza uma partida', () => {
  assert.deepEqual(normalizeScore({ score: 1840, durationMs: 58_400, correctAnswers: 4 }), {
    score: 1840,
    durationMs: 58400,
    correctAnswers: 4
  });
  assert.throws(() => normalizeScore({ score: 9999999, durationMs: -1, correctAnswers: 99 }));
});

test('ranking mantém melhor resultado por jogador e desempata por tempo', () => {
  const ranked = rankScores([
    { playerId: 'a', name: 'Ana', company: 'A', score: 900, durationMs: 50000, createdAt: '2026-09-04T08:00:00Z' },
    { playerId: 'a', name: 'Ana', company: 'A', score: 1100, durationMs: 60000, createdAt: '2026-09-04T08:02:00Z' },
    { playerId: 'b', name: 'Bruno', company: 'B', score: 1100, durationMs: 55000, createdAt: '2026-09-04T08:01:00Z' },
    { playerId: 'c', name: 'Carla', company: 'C', score: 700, durationMs: 40000, createdAt: '2026-09-04T08:03:00Z' }
  ]);
  assert.deepEqual(ranked.map((entry) => entry.playerId), ['b', 'a', 'c']);
  assert.deepEqual(ranked.map((entry) => entry.position), [1, 2, 3]);
});
