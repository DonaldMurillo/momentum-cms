/**
 * Shared handler result type used by all framework-agnostic route handlers.
 * Adapters translate this into their native response format.
 */
export interface HandlerResult<TBody = unknown> {
	status: number;
	body: TBody;
	headers?: Record<string, string>;
}
