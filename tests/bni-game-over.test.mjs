import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SITE_URL || 'http://127.0.0.1:4174/bni-up-4-setembro/?demo=1';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));

await page.goto(base, { waitUntil: 'networkidle' });
await page.fill('#memberSelect', 'Amílcar César');
await page.click('#joinButton');
await page.evaluate(() => window.__bniDebug.setState({ slide: 14, phase: 'game', gameOpen: true, version: 30 }));
await page.click('#startGameButton');

let answered = 0;
const started = Date.now();
while (Date.now() - started < 45_000) {
  if (await page.locator('#bniGame').getAttribute('data-game-over') === 'true') break;
  const open = await page.locator('#questionDialog').evaluate((dialog) => dialog.open);
  if (open) {
    await page.locator('#questionOptions button').nth(2).click();
    answered += 1;
    await page.waitForTimeout(900);
  } else {
    await page.waitForTimeout(250);
  }
}

assert.equal(await page.locator('#bniGame').getAttribute('data-lives'), '0');
assert.equal(await page.locator('#bniGame').getAttribute('data-game-over'), 'true');
assert.equal(await page.locator('#gameOverPanel').isVisible(), true);
assert.equal(await page.locator('#gameResult').isHidden(), true);
assert.equal(await page.locator('#startGameButton').innerText(), 'Tentar de novo');
assert.equal(await page.locator('#gameHudLives').innerText(), 'SEM VIDAS');

await page.click('#startGameButton');
await page.waitForTimeout(700);
assert.equal(await page.locator('#bniGame').getAttribute('data-lives'), '3');
assert.equal(await page.locator('#bniGame').getAttribute('data-game-over'), 'false');
assert.equal(await page.locator('#gameOverPanel').isHidden(), true);
assert.deepEqual(errors, []);

console.log(JSON.stringify({ gameOver: true, livesLost: 3, answered, retryResetLives: 3, errors }, null, 2));
await browser.close();
