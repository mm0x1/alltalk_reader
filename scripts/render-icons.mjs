/** Renders static/icons/icon.svg to the PNG sizes the web app manifest and iOS need. */
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const [svgPath = 'static/icons/icon.svg', outDir = 'static/icons'] = process.argv.slice(2);
const svg = readFileSync(svgPath, 'utf8');
const browser = await chromium.launch();
for (const [name, size, pad] of [
	['icon-192.png', 192, 0],
	['icon-512.png', 512, 0],
	['apple-touch-icon.png', 180, 0],
	['icon-maskable-512.png', 512, 0.1]
]) {
	const page = await browser.newPage({ viewport: { width: size, height: size } });
	const inner = Math.round(size * (1 - pad * 2));
	const body = pad
		? `<div style="width:${size}px;height:${size}px;background:#22355a;display:grid;place-items:center">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `).replace('rx="112"', 'rx="0"')}</div>`
		: svg.replace('<svg ', `<svg width="${size}" height="${size}" `);
	await page.setContent(
		`<html><body style="margin:0;background:transparent">${body}</body></html>`
	);
	await page.screenshot({
		path: `${outDir}/${name}`,
		omitBackground: !pad,
		clip: { x: 0, y: 0, width: size, height: size }
	});
}
await browser.close();
