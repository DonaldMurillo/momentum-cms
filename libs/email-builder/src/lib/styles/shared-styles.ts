/**
 * Shared CSS for email builder form controls.
 * Uses mcms CSS variables for dark mode support.
 *
 * Import into component `styles` arrays to avoid duplication.
 */
export const EML_FORM_STYLES = `
	.eml-block-editor {
		display: flex;
		flex-direction: column;
		gap: 12px;
		padding: 12px;
	}

	.eml-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.eml-label {
		font-size: 12px;
		font-weight: 600;
		color: hsl(var(--mcms-muted-foreground));
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.eml-help-text {
		font-size: 13px;
		color: hsl(var(--mcms-muted-foreground));
		line-height: 1.4;
	}

	.eml-input {
		height: 36px;
		width: 100%;
		border-radius: 6px;
		border: 1px solid hsl(var(--mcms-border));
		background-color: hsl(var(--mcms-background));
		color: hsl(var(--mcms-foreground));
		padding: 0 10px;
		font-size: 14px;
		outline: none;
		transition: border-color 0.15s, box-shadow 0.15s;
	}

	.eml-input:focus {
		border-color: hsl(var(--mcms-primary));
		box-shadow: 0 0 0 2px hsl(var(--mcms-primary) / 0.15);
	}

	.eml-textarea {
		height: auto;
		padding: 8px 10px;
		resize: vertical;
		font-family: inherit;
		line-height: 1.5;
	}

	.eml-input-color {
		width: 48px;
		height: 36px;
		padding: 2px;
		border-radius: 6px;
		border: 1px solid hsl(var(--mcms-border));
		background-color: hsl(var(--mcms-background));
		cursor: pointer;
	}

	select.eml-input {
		appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2371717a' d='M3 4.5L6 7.5L9 4.5'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 10px center;
		padding-right: 28px;
	}
`;
