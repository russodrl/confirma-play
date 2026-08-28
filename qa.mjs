import { chromium, devices } from 'playwright';
import { mkdir } from 'node:fs/promises';

const baseURL = process.env.QA_URL || 'http://127.0.0.1:4174';
await mkdir('qa', { recursive: true });

const browser = await chromium.launch({ headless: true });
const results = [];

async function run(name, contextOptions, viewport) {
  const context = await browser.newContext({ locale: 'pt-BR', ...contextOptions });
  const page = await context.newPage();
  if (viewport) await page.setViewportSize(viewport);
  await page.route('**/api/quote', async (route) => {
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, id: 'CP-QA-LOCAL', notificationSent: false })
    });
  });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.goto(`${baseURL}/?utm_source=qa&utm_campaign=launch`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(700);

  const bodyBox = await page.locator('body').boundingBox();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  const quoteLinks = await page.locator('[data-quote-link]').count();
  const quoteHref = await page.locator('[data-quote-link]').first().getAttribute('href');
  const title = await page.title();
  const heroVisible = await page.locator('h1').isVisible();

  for (const section of await page.locator('main section').all()) {
    await section.scrollIntoViewIfNeeded();
    await page.waitForTimeout(80);
  }
  await page.locator('body').evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(250);

  const fixedGeometry = await page.evaluate(() => {
    const header = document.querySelector('.site-header').getBoundingClientRect();
    const skip = document.querySelector('.skip-link').getBoundingClientRect();
    const mobileCta = document.querySelector('.mobile-cta').getBoundingClientRect();
    return {
      headerTop: header.top,
      skipBottom: skip.bottom,
      mobileCtaVisible: getComputedStyle(document.querySelector('.mobile-cta')).display !== 'none',
      mobileCtaBottom: mobileCta.bottom,
      viewportHeight: window.innerHeight
    };
  });

  const faq = page.locator('.faq-item').first();
  await faq.locator('button').click();
  const faqOpen = await faq.evaluate((node) => node.classList.contains('is-open'));
  const faqExpanded = await faq.locator('button').getAttribute('aria-expanded');

  if (await page.locator('.menu-toggle').isVisible()) {
    await page.locator('.menu-toggle').click();
    const menuOpen = await page.locator('#mainNav').evaluate((node) => node.classList.contains('is-open'));
    if (!menuOpen) throw new Error(`${name}: mobile menu did not open`);
    await page.locator('.menu-toggle').click();
  }

  await page.screenshot({ path: `qa/${name}.png`, fullPage: true });

  await page.locator('#quoteForm [name="name"]').fill('Teste local de QA');
  await page.locator('#quoteForm [name="phone"]').fill('+351 900 000 000');
  await page.locator('#quoteForm [name="eventType"]').selectOption('Aniversário infantil');
  await page.locator('#quoteForm [name="eventDate"]').fill('2026-12-20');
  await page.locator('#quoteForm [name="guests"]').fill('50');
  await page.locator('#quoteForm [name="features"]').first().check({ force: true });
  await page.locator('#quoteForm [name="consent"]').check();
  await page.locator('#quoteForm [type="submit"]').click();
  await page.waitForSelector('#quoteForm.is-success');
  const quoteSubmitted = (await page.locator('#quoteStatus').textContent())?.includes('CP-QA-LOCAL');

  const result = { name, title, heroVisible, quoteLinks, quoteHref, faqOpen, faqExpanded, quoteSubmitted, overflow, fixedGeometry, bodyWidth: bodyBox?.width, consoleErrors, pageErrors };
  results.push(result);

  if (!title.includes('Confirma Play')) throw new Error(`${name}: wrong title`);
  if (!heroVisible) throw new Error(`${name}: hero is hidden`);
  if (quoteLinks < 4) throw new Error(`${name}: missing quote CTAs`);
  if (quoteHref !== '#cotacao') throw new Error(`${name}: quote CTA does not point to the native form`);
  if (!faqOpen || faqExpanded !== 'true') throw new Error(`${name}: FAQ interaction failed`);
  if (!quoteSubmitted) throw new Error(`${name}: native quote form did not submit`);
  if (Math.abs(fixedGeometry.headerTop) > 1) throw new Error(`${name}: fixed header is not at viewport top`);
  if (fixedGeometry.skipBottom >= 0) throw new Error(`${name}: skip link is visible without focus`);
  if (fixedGeometry.mobileCtaVisible && fixedGeometry.mobileCtaBottom > fixedGeometry.viewportHeight + 1) throw new Error(`${name}: mobile CTA is outside the safe viewport`);
  if (overflow) throw new Error(`${name}: horizontal overflow detected`);
  if (pageErrors.length) throw new Error(`${name}: page errors: ${pageErrors.join('; ')}`);
  await context.close();
}

await run('desktop', {}, { width: 1440, height: 1000 });
await run('mobile', { ...devices['iPhone 13'] });
await browser.close();
console.log(JSON.stringify(results, null, 2));
