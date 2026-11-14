// Renders the PNG app icons from public/favicon.svg (run once: node scripts/make-icons.mjs)
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const svg = readFileSync(path.join(root, 'public/favicon.svg'), 'utf8');
const maskable = svg
  .replace('rx="116"', 'rx="0"')
  .replace('<g transform="rotate(-13', '<g transform="translate(256 256) scale(0.78) translate(-256 -256)"><g transform="rotate(-13')
  .replace('</svg>', '</g></svg>');

const browser = await chromium.launch();
const page = await browser.newPage();
async function render(source, size, file, bg = 'transparent') {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:${bg}">${source.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: path.join(root, 'public', file), omitBackground: bg === 'transparent' });
}
await render(svg, 192, 'icon-192.png');
await render(svg, 512, 'icon-512.png');
await render(maskable, 512, 'icon-maskable-512.png');
// iOS draws its own rounded corners, so the touch icon is full-bleed.
await render(maskable.replace('scale(0.78)', 'scale(0.9)'), 180, 'apple-touch-icon.png');
await browser.close();
console.log('icons written');
