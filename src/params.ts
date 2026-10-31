import { defineParams } from '@sveltejs/kit/params';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const POSITION = /^(?:0|[1-9]\d{0,6})$/;
const HASH = /^[0-9a-f]{64}$/;

export const params = defineParams({
	uuid: (param) => (UUID.test(param) ? param : undefined),
	/** A non-negative whole number without leading zeros, so it round-trips through String(). */
	position: (param) => (POSITION.test(param) ? Number(param) : undefined),
	hash: (param) => (HASH.test(param) ? param : undefined)
});
