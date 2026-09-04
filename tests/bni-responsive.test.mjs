import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const base = process.env.SITE_URL || 'http://127.0.0.1:4186/bni-up-4-setembro/?demo=1';
const browser = await chromium.launch({ headless: true });
const sizes = [
  { width: 320, height: 568, mobile: true },
  { width: 360, height: 640, mobile: true },
  { width: 412, height: 915, mobile: true },
  { width: 1280, height: 720, mobile: false },
  { width: 1920, height: 1080, mobile: false }
];
const results = [];
for (const size of sizes) {
  const page = await browser.newPage({ viewport: { width: size.width, height: size.height }, isMobile: size.mobile, hasTouch: size.mobile });
  await page.goto(base, { waitUntil: 'networkidle' });
  await page.fill('#memberSelect', 'Amílcar César');
  await page.fill('#companyInput', 'i9Cozinhas');
  await page.click('#joinButton');
  await page.evaluate(() => window.__bniDebug.setState({ slide: 14, phase: 'game', gameOpen: true, version: 2 }));
  await page.waitForTimeout(650);
  const geometry = await page.evaluate(() => {
    const button = document.querySelector('#startGameButton').getBoundingClientRect();
    const canvas = document.querySelector('#bniGame').getBoundingClientRect();
    return {
      innerWidth,
      innerHeight,
      scrollWidth: document.documentElement.scrollWidth,
      buttonTop: button.top,
      buttonBottom: button.bottom,
      canvasWidth: canvas.width,
      canvasHeight: canvas.height
    };
  });
  assert.ok(geometry.scrollWidth <= geometry.innerWidth + 1, JSON.stringify({ size, geometry }));
  assert.ok(geometry.buttonTop >= 0 && geometry.buttonBottom <= geometry.innerHeight, JSON.stringify({ size, geometry }));
  assert.ok(geometry.canvasWidth > 250 && geometry.canvasHeight > 120, JSON.stringify({ size, geometry }));
  results.push({ size, geometry });
  await page.close();
}
console.log(JSON.stringify(results, null, 2));
await browser.close();
