import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SITE_URL || 'http://127.0.0.1:4186/bni-up-4-setembro/?demo=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(`page:${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });

await page.goto(base, { waitUntil: 'networkidle' });
assert.equal(await page.locator('#memberOptions option').count(), 28);
await page.fill('#memberSelect', 'Amilcar Ceasar');
await page.click('#joinButton');
await page.waitForSelector('#experience:not([hidden])');
assert.match(await page.locator('#participantBadge').innerText(), /Amílcar César/);

await page.evaluate(() => window.__bniDebug.setState({ slide: 12, phase: 'personalized', gameOpen: false, version: 10 }));
await page.waitForTimeout(100);
assert.match(await page.locator('#personalizedSlide').innerText(), /i9Cozinhas/);
assert.match(await page.locator('#personalizedSlide').innerText(), /cozinhas por medida/i);
assert.match(await page.locator('#personalizedSlide').innerText(), /10 resultados/i);

await page.evaluate(() => window.__bniDebug.setState({ slide: 14, phase: 'game', gameOpen: false, version: 11 }));
assert.equal(await page.locator('#gameLocked').isVisible(), true);
await page.evaluate(() => window.__bniDebug.setState({ slide: 14, phase: 'game', gameOpen: true, version: 12 }));
assert.equal(await page.locator('#startGameButton').isVisible(), true);
await page.click('#startGameButton');
await page.waitForTimeout(600);
const distance = Number(await page.locator('#bniGame').getAttribute('data-distance'));
assert.ok(distance > 120);
await page.click('#jumpButton');

const dimensions = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, innerWidth: window.innerWidth }));
assert.ok(dimensions.scrollWidth <= dimensions.innerWidth + 1, JSON.stringify(dimensions));
assert.deepEqual(errors, []);

const presenter = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await presenter.goto(`${base}&presenter=1`, { waitUntil: 'networkidle' });
await presenter.fill('#presenterPin', '482731');
await presenter.click('#presenterLoginButton');
assert.equal(await presenter.locator('#presenterControls').isVisible(), true);
assert.equal(await presenter.locator('[data-slide-button]').count(), 17);
assert.equal(await presenter.locator('#releaseGameButton').count(), 1);

const visitor = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
await visitor.goto(base, { waitUntil: 'networkidle' });
await visitor.fill('#memberSelect', 'Visitante');
await visitor.click('#joinButton');
await visitor.waitForSelector('#experience:not([hidden])');
assert.match(await visitor.locator('#participantBadge').innerText(), /Visitante/);
await visitor.evaluate(() => window.__bniDebug.setState({ slide: 12, phase: 'personalized', gameOpen: false, version: 30 }));
assert.match(await visitor.locator('#personalizedSlide').innerText(), /Empresa sorteada para o visitante/i);
assert.ok((await visitor.locator('#participantBadge small').innerText()).length > 2);

console.log(JSON.stringify({ members: 27, participant: 'amilcar-cesar', distance, presenterControls: true, overflow: dimensions.scrollWidth - dimensions.innerWidth, errors }, null, 2));
await browser.close();
