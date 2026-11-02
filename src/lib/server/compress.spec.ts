import { describe, expect, it } from 'vitest';
import { brotliDecompressSync, gunzipSync } from 'node:zlib';
import { compress, pickEncoding } from './compress.js';

const page = 'It is a truth universally acknowledged. '.repeat(200);

function respond(body: string, headers: Record<string, string> = {}, status = 200) {
	return new Response(body, {
		status,
		headers: { 'content-type': 'text/html; charset=utf-8', ...headers }
	});
}
const ask = (acceptEncoding?: string, method = 'GET') =>
	new Request('http://readhouse.example/book/1', {
		method,
		headers: acceptEncoding ? { 'accept-encoding': acceptEncoding } : {}
	});

describe('pickEncoding', () => {
	it('prefers brotli, then gzip, and honours q=0', () => {
		expect(pickEncoding('gzip, deflate, br, zstd')).toBe('br');
		expect(pickEncoding('gzip')).toBe('gzip');
		expect(pickEncoding('br;q=0, gzip;q=0.8')).toBe('gzip');
		expect(pickEncoding('identity')).toBeNull();
		expect(pickEncoding(null)).toBeNull();
	});
});

describe('compress', () => {
	it('brotli-compresses a page and keeps it intact', async () => {
		const response = compress(ask('gzip, br'), respond(page, { etag: '"abc"' }));
		expect(response.headers.get('content-encoding')).toBe('br');
		expect(response.headers.get('vary')).toContain('Accept-Encoding');
		expect(response.headers.get('etag')).toBe('W/"abc"');
		const bytes = Buffer.from(await response.arrayBuffer());
		expect(bytes.length).toBeLessThan(page.length / 4);
		expect(brotliDecompressSync(bytes).toString()).toBe(page);
	});

	it('gzips JSON for clients without brotli', async () => {
		const body = JSON.stringify({ text: page });
		const response = compress(ask('gzip'), respond(body, { 'content-type': 'application/json' }));
		expect(response.headers.get('content-encoding')).toBe('gzip');
		expect(gunzipSync(Buffer.from(await response.arrayBuffer())).toString()).toBe(body);
	});

	it('leaves audio, ranges, small bodies, HEAD and plain clients alone', async () => {
		const cases = [
			compress(ask('br'), respond(page, { 'content-type': 'audio/mp4' })),
			compress(ask('br'), respond(page, { 'content-range': 'bytes 0-9/100' }, 206)),
			compress(ask('br'), respond('short', { 'content-length': '5' })),
			compress(ask('br'), respond(page, { 'cache-control': 'no-transform' })),
			compress(ask('br', 'HEAD'), respond(page)),
			compress(ask(), respond(page))
		];
		for (const response of cases) expect(response.headers.has('content-encoding')).toBe(false);
		expect(await cases.at(-1)!.text()).toBe(page);
	});
});
