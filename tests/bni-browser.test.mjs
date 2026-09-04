import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SITE_URL || 'http://127.0.0.1:4186/bni-up-4-setembro/?demo=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(`page:${error.message}`));
page.on('console', (message) => { if (message.type() === 'error') errors.push(`console:${message.text()}`); });

await page.goto(base, { waitUntil: 'networkidle' });
assert.equal(await page.locator('#memberOptions option').count(), 27);
await page.fill('#memberSelect', 'Amilcar Ceasar');
assert.equal(await page.inputValue('#companyInput'), 'i9Cozinhas');
await page.fill('#companyInput', 'i9 Cosinhas');
await page.click('#joinButton');
await page.waitForSelector('#experience:not([hidden])');
assert.match(await page.locator('#participantBadge').innerText(), /Amílcar César/);

await page.evaluate(() => window.__bniDebug.setState({ slide: 4, phase: 'personalized', gameOpen: false, version: 10 }));
await page.waitForTimeout(100);
assert.match(await page.locator('#personalizedSlide').innerText(), /i9Cozinhas/);
assert.match(await page.locator('#personalizedSlide').innerText(), /cozinhas por medida/i);
assert.match(await page.locator('#personalizedSlide').innerText(), /10 resultados/i);

await page.evaluate(() => window.__bniDebug.setState({ slide: 6, phase: 'game', gameOpen: false, version: 11 }));
assert.equal(await page.locator('#gameLocked').isVisible(), true);
await page.evaluate(() => window.__bniDebug.setState({ slide: 6, phase: 'game', gameOpen: true, version: 12 }));
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
assert.equal(await presenter.locator('[data-slide-button]').count(), 9);
assert.equal(await presenter.locator('#releaseGameButton').count(), 1);

console.log(JSON.stringify({ members: 27, participant: 'amilcar-cesar', distance, presenterControls: true, overflow: dimensions.scrollWidth - dimensions.innerWidth, errors }, null, 2));
await browser.close();
