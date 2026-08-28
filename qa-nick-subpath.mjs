import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.QA_URL || 'http://127.0.0.1:4186';
await mkdir('qa/nick-subpath', { recursive: true });
const browser = await chromium.launch({ headless: true });
const results = [];

async function run(name, options, viewport) {
  const context = await browser.newContext({ locale: 'pt-PT', ...options });
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  const pageErrors = [];
  const failed = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('requestfailed', (request) => failed.push(`${request.method()} ${request.url()} ${request.failure()?.errorText}`));

  await page.goto(`${baseURL}/nick-7meses/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);

  const title = await page.title();
  const heroVisible = await page.locator('.hero h1').isVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const unprefixed = await page.evaluate(() => [...document.querySelectorAll('[src], [href]')]
    .map((node) => node.getAttribute('src') || node.getAttribute('href'))
    .filter((value) => value?.startsWith('/assets/') || value === '/app.js' || value === '/styles.css' || value === '/sw.js'));

  const keyImages = await page.evaluate(() => [...document.querySelectorAll([
    'img[src*="convite-nicolas"]',
    'img[src*="donald-background"]',
    'img[src*="album/1m_06"]',
    'img[src*="donald-avatar"]'
  ].join(','))].map((img) => ({ src: img.getAttribute('src'), width: img.naturalWidth })));

  await page.locator('#rsvpHero').click();
  await page.waitForTimeout(700);
  const rsvpVisible = await page.locator('#rsvpSection').isVisible();
  await page.locator('#rsvpSection').scrollIntoViewIfNeeded();
  await page.waitForTimeout(250);
  await page.evaluate(() => document.activeElement?.blur());
  await page.locator('#rsvpSection').screenshot({ path: `qa/nick-subpath/${name}-rsvp.png` });

  if (await page.locator('#menuToggle').isVisible()) {
    await page.locator('#menuToggle').click();
    if ((await page.locator('#menuToggle').getAttribute('aria-expanded')) !== 'true') throw new Error(`${name}: menu did not open`);
    await page.locator('#menuToggle').click();
  }

  await page.locator('.game-shell').evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction(() => document.querySelector('#gameDialogueText')?.textContent?.length > 0, null, { timeout: 5000 });
  await page.locator('#gameDialogue').click({ position: { x: 20, y: 20 } });
  await page.waitForFunction(() => document.querySelector('#gameDialogueText')?.textContent?.length > 30, null, { timeout: 3000 });
  const dialogueText = await page.locator('#gameDialogueText').textContent();
  await page.evaluate(() => document.activeElement?.blur());
  await page.locator('.game-shell').screenshot({ path: `qa/nick-subpath/${name}-game.png` });

  const result = { name, title, heroVisible, rsvpVisible, dialogueLength: dialogueText?.length || 0, overflow, unprefixed, keyImages, pageErrors, failed };
  results.push(result);
  if (!title.includes('Nick')) throw new Error(`${name}: wrong title`);
  if (!heroVisible || !rsvpVisible) throw new Error(`${name}: hero or RSVP did not open`);
  if ((dialogueText?.length || 0) < 30) throw new Error(`${name}: game dialogue did not finish`);
  if (overflow) throw new Error(`${name}: horizontal overflow`);
  if (unprefixed.length) throw new Error(`${name}: unprefixed browser resources: ${unprefixed.join(', ')}`);
  if (keyImages.some((image) => image.width < 1)) throw new Error(`${name}: key image failed: ${JSON.stringify(keyImages)}`);
  if (pageErrors.length) throw new Error(`${name}: page errors: ${pageErrors.join('; ')}`);
  await context.close();
}

await run('desktop', {}, { width: 1440, height: 1000 });
await run('mobile', { ...devices['iPhone 13'] });
await browser.close();
console.log(JSON.stringify(results, null, 2));
