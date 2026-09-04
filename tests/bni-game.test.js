import test from 'node:test';
import assert from 'node:assert/strict';
import { members } from '../lib/bni-members.js';
import { buildGameQuestions, createGameState, answerCheckpoint, advanceGame, hitObstacle } from '../public/bni-up-4-setembro/game.js';

test('jogo cria seis checkpoints sobre indicação ao Russo, IA e marketing digital', () => {
  const member = members.find((item) => item.slug === 'amilcar-cesar');
  const questions = buildGameQuestions(member, members);
  assert.equal(questions.length, 6);
  const content = JSON.stringify(questions);
  assert.ok(questions.filter((question) => /Russo/i.test(question.prompt)).length >= 2);
  assert.match(content, /inteligência artificial|\bIA\b/i);
  assert.match(content, /marketing digital/i);
  assert.match(content, /indicar|indicação/i);
  assert.match(content, /Pipedrive/);
  assert.match(content, /Make/);
  assert.doesNotMatch(content, /Digital Roots Lab/i);
  for (const question of questions) {
    assert.equal(question.personalized, false);
    assert.equal(question.options.length, 3);
    assert.ok(Number.isInteger(question.correct));
    assert.ok(question.correct >= 0 && question.correct < 3);
  }
});

test('resposta correta concede pontos e um benefício; resposta errada não concede', () => {
  const initial = createGameState();
  const correct = answerCheckpoint(initial, { correct: 1, power: 'boost' }, 1);
  assert.equal(correct.correctAnswers, 1);
  assert.ok(correct.score > initial.score);
  assert.equal(correct.power, 'boost');
  const wrong = answerCheckpoint(correct, { correct: 0, power: 'shield' }, 2);
  assert.equal(wrong.correctAnswers, 1);
  assert.equal(wrong.power, 'boost');
});

test('corrida só termina ao alcançar o pódio', () => {
  const initial = createGameState();
  const middle = advanceGame(initial, 6_000, 16);
  assert.equal(middle.won, false);
  const finish = advanceGame(middle, 12_500, 16);
  assert.equal(finish.won, true);
  assert.equal(finish.stage, 'podio');
});

test('estado inicial mantém jogo parado até liberação externa', () => {
  const initial = createGameState();
  assert.equal(initial.running, false);
  assert.equal(initial.won, false);
  assert.equal(initial.score, 0);
  assert.equal(initial.correctAnswers, 0);
  assert.equal(initial.lives, 3);
  assert.equal(initial.gameOver, false);
});

test('três colisões sem escudo encerram a partida', () => {
  const initial = { ...createGameState(), running: true, score: 500 };
  const first = hitObstacle(initial);
  assert.equal(first.lives, 2);
  assert.equal(first.gameOver, false);
  const second = hitObstacle(first);
  assert.equal(second.lives, 1);
  assert.equal(second.gameOver, false);
  const third = hitObstacle(second);
  assert.equal(third.lives, 0);
  assert.equal(third.gameOver, true);
  assert.equal(third.running, false);
});

test('escudo absorve colisão sem retirar vida', () => {
  const protectedState = { ...createGameState(), running: true, shield: 1 };
  const afterHit = hitObstacle(protectedState);
  assert.equal(afterHit.lives, 3);
  assert.equal(afterHit.shield, 0);
  assert.equal(afterHit.gameOver, false);
});
