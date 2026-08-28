import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const robots = await readFile(new URL('../public/robots.txt', import.meta.url), 'utf8');

const occurrences = (value, source = html) => source.split(value).length - 1;

test('contains the core commercial promise and offer', () => {
  assert.match(html, /pronto em até 24 horas/i);
  assert.match(html, /confirmação de presença/i);
  assert.match(html, /jogo personalizado/i);
  assert.match(html, /Quero entrar em cotação/i);
});

test('all quote CTAs point to the native form', () => {
  assert.ok(occurrences('data-quote-link') >= 4);
  assert.equal(occurrences('data-quote-link'), occurrences('data-quote-link href="#cotacao"'));
  assert.match(html, /id="quoteForm"/);
  assert.match(app, /fetch\('\/api\/quote'/);
  assert.doesNotMatch(html + app, /tally\.so/i);
});

test('has SEO and social metadata for the custom domain', () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/confirma-play\.com\/">/);
  assert.match(html, /property="og:image"/);
  assert.match(html, /"@type": "FAQPage"/);
  assert.match(robots, /https:\/\/confirma-play\.com\/sitemap\.xml/);
});

test('has accessible navigation and FAQ controls', () => {
  assert.match(html, /class="skip-link"/);
  assert.match(html, /aria-controls="mainNav"/);
  assert.equal(occurrences('class="faq-item reveal"'), 6);
  assert.equal(occurrences('aria-expanded="false"'), 7);
});
