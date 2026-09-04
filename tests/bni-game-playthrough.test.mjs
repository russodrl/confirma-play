import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SITE_URL || 'http://127.0.0.1:4186/bni-up-4-setembro/?demo=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.goto(base, { waitUntil: 'networkidle' });
await page.fill('#memberSelect', 'Amílcar César');
await page.fill('#companyInput', 'i9Cozinhas');
await page.click('#joinButton');
await page.evaluate(() => window.__bniDebug.setState({ slide: 14, phase: 'game', gameOpen: true, version: 20 }));
await page.click('#startGameButton');

const correctAnswers = [1, 1, 1, 0, 1, 0];
const obstacles = [1_050, 2_500, 4_150, 5_950, 7_650, 9_400, 11_050];
const jumped = new Set();
let answered = 0;
const started = Date.now();
while (Date.now() - started < 90_000) {
  const won = await page.locator('#bniGame').getAttribute('data-won');
  if (won === 'true') break;
  const open = await page.locator('#questionDialog').evaluate((dialog) => dialog.open);
  if (open && answered < correctAnswers.length) {
    await page.locator('#questionOptions button').nth(correctAnswers[answered]).click();
    answered += 1;
    await page.waitForTimeout(900);
  } else {
    const distance = Number(await page.locator('#bniGame').getAttribute('data-distance'));
    const obstacle = obstacles.find((position) => !jumped.has(position) && distance >= position - 58 && distance < position - 20);
    if (obstacle) {
      jumped.add(obstacle);
      await page.evaluate(() => document.querySelector('#bniGame').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })));
    }
    await page.waitForTimeout(35);
  }
}

assert.equal(await page.locator('#bniGame').getAttribute('data-won'), 'true');
assert.equal(answered, 6);
assert.equal(await page.locator('#bniGame').getAttribute('data-correct-answers'), '6');
assert.match(await page.locator('#gameResult').innerText(), /chegou ao pódio/i);
assert.match(await page.locator('#rankingList').innerText(), /Amílcar César/);
assert.deepEqual(errors, []);
console.log(JSON.stringify({ won: true, answered, score: await page.locator('#bniGame').getAttribute('data-score'), durationMs: Date.now() - started, errors }, null, 2));
await browser.close();
