/**
 * Preview Renderer for Momentum CMS
 *
 * Generates a styled HTML page from document data and collection config.
 * Used by the built-in preview endpoint to render live previews in the admin iframe.
 */

import type { CollectionConfig, Field } from '@momentumcms/core';

/** Custom field renderer: receives the field value and returns an HTML string to embed. */
export type CustomFieldRenderer = (value: unknown, field: Field) => string;

/** Options for rendering a preview HTML page. */
export interface PreviewRenderOptions {
	/** Document data to render */
	doc: Record<string, unknown>;
	/** Collection configuration */
	collection: CollectionConfig;
	/**
	 * Optional custom field renderers keyed by `admin.editor` value.
	 * When a field's `admin.editor` matches a key, the custom renderer is used
	 * instead of the default switch-case logic.
	 */
	customFieldRenderers?: Record<string, CustomFieldRenderer>;
}

/**
 * Render a styled HTML preview page from document data.
 *
 * The page includes:
 * - Styled rendering of each visible field
 * - Inline CSS for responsive layout
 * - postMessage listener for live updates from the admin form
 *
 * Security: All field values (including rich text) are HTML-escaped in both
 * the initial server render and the client-side postMessage handler.
 */
export function renderPreviewHTML(options: PreviewRenderOptions): string {
	const { doc, collection, customFieldRenderers } = options;
	const titleField = collection.admin?.useAsTitle ?? 'id';
	const title = escapeHtml(String(doc[titleField] ?? doc['id'] ?? 'Untitled'));
	const fields = collection.fields ?? [];

	const fieldHtml = fields
		.filter((f) => !isHiddenField(f) && !isLayoutField(f) && f.name !== titleField)
		.map((f) => renderField(f, doc, customFieldRenderers))
		.filter(Boolean)
		.join('\n');

	// Build a JSON map of which fields are rich text for the client script
	const richTextFields = fields.filter((f) => f.type === 'richText').map((f) => f.name);

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Preview: ${title}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;line-height:1.6;color:#1a1a2e;background:#fff;padding:2rem;max-width:720px;margin:0 auto}
h1{font-size:2rem;font-weight:700;margin-bottom:1.5rem;color:#0f0f23;border-bottom:2px solid #e2e8f0;padding-bottom:0.75rem}
.field{margin-bottom:1.25rem}
.field-label{font-size:0.75rem;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;margin-bottom:0.25rem}
.field-value{font-size:1rem;color:#334155}
.field-value:empty::after{content:"\\2014";color:#94a3b8}
.field-value.rich-text{line-height:1.7}
.field-value.rich-text h1,.field-value.rich-text h2,.field-value.rich-text h3{margin:1rem 0 0.5rem}
.field-value.rich-text p{margin:0.5rem 0}
.field-value.rich-text ul,.field-value.rich-text ol{margin:0.5rem 0;padding-left:1.5rem}
.field-value.rich-text a{color:#2563eb;text-decoration:underline}
.badge{display:inline-block;padding:0.125rem 0.5rem;border-radius:9999px;font-size:0.8rem;font-weight:500}
.badge-true{background:#dcfce7;color:#166534}
.badge-false{background:#fee2e2;color:#991b1b}
@media(max-width:480px){body{padding:1rem}h1{font-size:1.5rem}}
</style>
</head>
<body>
<h1 data-field="${escapeHtml(titleField)}">${title}</h1>
${fieldHtml}
<script>
(function(){
var richTextFields=${JSON.stringify(richTextFields)};
window.addEventListener('message',function(e){
if(e.origin!==window.location.origin)return;
if(!e.data||e.data.type!=='momentum-preview-update')return;
var d=e.data.data;if(!d)return;
document.querySelectorAll('[data-field]').forEach(function(el){
var key=el.getAttribute('data-field');
var val=d[key];
if(val===undefined||val===null)return;
if(typeof val==='boolean'){
el.textContent=val?'Yes':'No';
}else{
el.textContent=String(val);
}
});
var titleEl=document.querySelector('h1[data-field]');
if(titleEl){var tf=titleEl.getAttribute('data-field');if(d[tf]!==undefined)titleEl.textContent=String(d[tf]);}
});
})();
</script>
</body>
</html>`;
}

/** Render a single field as HTML. */
function renderField(
	field: Field,
	doc: Record<string, unknown>,
	customRenderers?: Record<string, CustomFieldRenderer>,
): string {
	const value = doc[field.name];
	if (value === undefined || value === null) {
		return renderFieldWrapper(field, '');
	}

	// Check for a custom renderer keyed by admin.editor
	const editorKey = field.admin?.editor;
	if (editorKey && customRenderers?.[editorKey]) {
		return renderFieldWrapper(field, customRenderers[editorKey](value, field));
	}

	switch (field.type) {
		case 'richText':
			// Preview is a summary view — always escape to prevent XSS
			// (POST preview sends user input; even GET data could contain stored XSS)
			return renderFieldWrapper(
				field,
				`<div class="field-value rich-text" data-field="${escapeHtml(field.name)}">${escapeHtml(String(value))}</div>`,
			);
		case 'checkbox':
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}">${value ? '<span class="badge badge-true">Yes</span>' : '<span class="badge badge-false">No</span>'}</div>`,
			);
		case 'date':
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}">${formatDate(value)}</div>`,
			);
		case 'select':
		case 'radio':
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}">${escapeHtml(String(value))}</div>`,
			);
		case 'json':
		case 'point':
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}"><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></div>`,
			);
		case 'password':
			return ''; // Never render passwords
		case 'array':
		case 'group':
		case 'blocks':
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}"><code>${escapeHtml(JSON.stringify(value, null, 2))}</code></div>`,
			);
		default:
			// text, textarea, email, number, slug, upload, relationship
			return renderFieldWrapper(
				field,
				`<div class="field-value" data-field="${escapeHtml(field.name)}">${escapeHtml(String(value))}</div>`,
			);
	}
}

/** Wrap a field value with label. */
function renderFieldWrapper(field: Field, valueHtml: string): string {
	const label = field.label ?? field.name;
	return `<div class="field">
<div class="field-label">${escapeHtml(label)}</div>
${valueHtml || `<div class="field-value" data-field="${escapeHtml(field.name)}"></div>`}
</div>`;
}

/** Check if a field should be hidden from preview. */
function isHiddenField(field: Field): boolean {
	if (field.admin?.hidden) return true;
	if (field.type === 'password') return true;
	return false;
}

/** Check if a field is a layout-only field (no data). */
function isLayoutField(field: Field): boolean {
	return field.type === 'tabs' || field.type === 'collapsible' || field.type === 'row';
}

/** Escape HTML special characters. */
function escapeHtml(str: string): string {
	return str
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/** Format a date value for display. */
function formatDate(value: unknown): string {
	if (!value) return '';
	try {
		const date = new Date(String(value));
		if (isNaN(date.getTime())) return escapeHtml(String(value));
		return escapeHtml(
			date.toLocaleDateString('en-US', {
				year: 'numeric',
				month: 'long',
				day: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			}),
		);
	} catch {
		return escapeHtml(String(value));
	}
}
