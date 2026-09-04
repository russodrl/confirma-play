import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../public/bni-up-4-setembro/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/bni-up-4-setembro/app.js', import.meta.url), 'utf8');

test('rota limpa do BNI UP resolve explicitamente para o index do subdiretório', () => {
  const route = config.rewrites?.find((item) => item.source === '/bni-up-4-setembro');
  assert.deepEqual(route, {
    source: '/bni-up-4-setembro',
    destination: '/bni-up-4-setembro/index.html'
  });
});

test('rota limpa não depende de barra final para carregar recursos', () => {
  assert.doesNotMatch(html, /(?:href|src)="\.\//);
  assert.doesNotMatch(app, /['"]\.\/assets\//);
  assert.match(html, /src="\/bni-up-4-setembro\/app\.js"/);
  assert.match(html, /href="\/bni-up-4-setembro\/styles\.css"/);
});

test('slide de personalização orienta a comparar com o celular ao lado', () => {
  assert.match(html, /Olhe para o celular de quem está ao seu lado\./);
  assert.match(html, /O próximo slide será diferente em cada tela\./);
  assert.doesNotMatch(html, /Agora olhe para o seu celular\./);
});

test('sincronização compartilha cache e nunca sobrepõe requisições', () => {
  assert.match(app, /fetch\('\/api\/bni-live'/);
  assert.doesNotMatch(app, /\/api\/bni-live\?ts=/);
  assert.doesNotMatch(app, /setInterval\(pollOnce/);
  assert.match(app, /setTimeout\(schedulePoll,/);
  assert.match(app, /pollInFlight/);
});

test('entrada permite digitar nome e empresa com sugestões', () => {
  assert.match(html, /<input id="memberSelect"[^>]+list="memberOptions"/);
  assert.match(html, /<datalist id="memberOptions"><\/datalist>/);
  assert.match(html, /<input id="companyInput"[^>]+list="companyOptions"/);
  assert.match(html, /<datalist id="companyOptions"><\/datalist>/);
  assert.doesNotMatch(html, /<select id="memberSelect"/);
});

test('apresentação ensina IA, marketing, uso conjunto, ferramentas e serviços antes da personalização', () => {
  assert.equal((html.match(/data-slide="\d+"/g) || []).length, 17);
  assert.match(html, /O poder da inteligência artificial/);
  assert.match(html, /O poder do marketing digital/);
  assert.match(html, /Quando IA e marketing trabalham juntos/);
  assert.match(html, /Resultados possíveis para uma empresa/);
  assert.match(html, /Ferramentas para usar no dia a dia/);
  assert.match(html, /O que o Russo faz pelos clientes/);
  assert.match(html, /Quando indicar o Russo/);
  assert.match(html, /id="personalizedSlide"[^>]+data-slide="12"/);
  assert.equal((html.match(/data-slide-button="\d+"/g) || []).length, 17);
});

test('controle e liberação do jogo usam a nova sequência de dezessete slides', () => {
  assert.match(app, /const phaseBySlide = \[[^\]]+\]/);
  assert.match(app, /Math\.min\(16, state\.slide \+ 1\)/);
  assert.match(app, /submitState\(\{ slide: 14, phase: 'game', gameOpen: true \}\)/);
});
