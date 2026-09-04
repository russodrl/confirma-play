import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import { members } from '../public/bni-up-4-setembro/members.js';

const base = process.env.SITE_URL || 'http://127.0.0.1:4186/bni-up-4-setembro/?demo=1';
const out = new URL('../.research/qa/', import.meta.url).pathname;
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });

async function openParticipant(viewport, memberSlug = 'amilcar-cesar') {
  const page = await browser.newPage({ viewport, isMobile: viewport.width < 600, hasTouch: viewport.width < 600 });
  await page.goto(base, { waitUntil: 'networkidle' });
  const member = members.find((entry) => entry.slug === memberSlug);
  await page.fill('#memberSelect', member.name);
  await page.click('#joinButton');
  await page.waitForSelector('#experience:not([hidden])');
  return page;
}

const mobile = await openParticipant({ width: 390, height: 844 });
for (const slide of [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  await mobile.evaluate((index) => window.__bniDebug.setState({ slide: index, phase: index === 12 ? 'personalized' : index >= 14 ? 'game' : 'presentation', gameOpen: index >= 14, version: index + 1 }), slide);
  await mobile.waitForTimeout(650);
  await mobile.screenshot({ path: `${out}/mobile-slide-${slide}.png`, fullPage: true });
}

const desktop = await openParticipant({ width: 1440, height: 900 }, 'aleksander-palamarczuk');
for (const slide of [0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]) {
  await desktop.evaluate((index) => window.__bniDebug.setState({ slide: index, phase: index === 12 ? 'personalized' : index >= 14 ? 'game' : 'presentation', gameOpen: index >= 14, version: index + 1 }), slide);
  await desktop.waitForTimeout(650);
  await desktop.screenshot({ path: `${out}/desktop-slide-${slide}.png`, fullPage: false });
}

console.log(JSON.stringify({ out, screenshots: 28 }, null, 2));
await browser.close();
