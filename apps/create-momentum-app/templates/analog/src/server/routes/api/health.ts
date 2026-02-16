import { defineEventHandler, setResponseHeader } from 'h3';

export default defineEventHandler((event) => {
	setResponseHeader(event, 'content-type', 'application/json');
	return { status: 'ok' };
});
