import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url), 'utf8'));
const html = await readFile(new URL('../public/bni-up-4-setembro/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/bni-up-4-setembro/app.js', import.meta.url), 'utf8');
const game = await readFile(new URL('../public/bni-up-4-setembro/game.js', import.meta.url), 'utf8');
const liveApi = await readFile(new URL('../api/bni-live.js', import.meta.url), 'utf8');
const detailedRunner = await readFile(new URL('../public/bni-up-4-setembro/assets/russo-runner-detailed.webp', import.meta.url));

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

test('API agrupa leituras simultâneas e evita consultar metadados a cada celular', () => {
  assert.match(liveApi, /createAsyncTtlCache/);
  assert.match(liveApi, /getCachedSnapshot/);
  assert.match(liveApi, /ensureStorageReady/);
  assert.match(liveApi, /s-maxage=1/);
  assert.match(liveApi, /getCachedSnapshot\.set/);
  const getBranch = liveApi.slice(liveApi.indexOf("if (req.method === 'GET')"), liveApi.indexOf("if (req.method !== 'POST')"));
  assert.doesNotMatch(getBranch, /ensureTabs\(/);
  assert.doesNotMatch(getBranch, /readSnapshot\(/);
});

test('entrada usa um único campo de nome com empresa na sugestão e opção de visitante', () => {
  assert.match(html, /<input id="memberSelect"[^>]+list="memberOptions"/);
  assert.match(html, /<datalist id="memberOptions"><\/datalist>/);
  assert.match(html, /Qual seu nome de membro no BNI\?/);
  assert.match(html, /Se tiver dúvida, está na ficha do BNI na sua frente\./);
  assert.doesNotMatch(html, /id="companyInput"/);
  assert.doesNotMatch(html, /id="companyOptions"/);
  assert.match(app, /Visitante/);
  assert.match(app, /visitante/);
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

test('jogo mostra três vidas, game over e usa o novo boneco detalhado', () => {
  assert.match(html, /id="gameHudLives">❤️❤️❤️<\/span>/);
  assert.match(app, /russo-runner-detailed\.webp/);
  assert.match(app, /onGameOver: handleGameOver/);
  assert.match(game, /this\.runnerImage/);
  assert.match(game, /gameOver/);
  assert.ok(detailedRunner.length > 100_000);
  assert.equal(detailedRunner.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(detailedRunner.subarray(8, 12).toString('ascii'), 'WEBP');
});

test('apresentação e perguntas não mencionam CRM nem Pipedrive', () => {
  assert.doesNotMatch(html, /\bCRM\b|Pipedrive/i);
  assert.doesNotMatch(game, /\bCRM\b|Pipedrive/i);
});
