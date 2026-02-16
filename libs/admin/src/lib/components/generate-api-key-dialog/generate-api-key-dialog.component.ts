import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import {
	Button,
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	DIALOG_DATA,
	Input,
	Label,
	Select,
} from '@momentumcms/ui';
import type { SelectOption } from '@momentumcms/ui';
import { MomentumAuthService } from '../../services/auth.service';

/** Data passed to the GenerateApiKeyDialog. */
export interface GenerateApiKeyDialogData {
	/** HTTP endpoint to POST to (e.g., '/api/auth/api-keys') */
	endpoint: string;
}

/** Response from the API key creation endpoint. */
interface ApiKeyCreateResponse {
	id: string;
	name: string;
	key: string;
	keyPrefix: string;
	role: string;
	expiresAt: string | null;
	createdAt: string;
}

/** Role hierarchy: lower index = higher privilege.
 * Keep in sync with AUTH_ROLES in @momentumcms/auth/collections */
const ROLE_HIERARCHY: SelectOption[] = [
	{ label: 'Admin', value: 'admin' },
	{ label: 'Editor', value: 'editor' },
	{ label: 'User', value: 'user' },
	{ label: 'Viewer', value: 'viewer' },
];

/**
 * Dialog for generating a new API key.
 *
 * Shows a form with name + role fields, calls the API endpoint,
 * then displays the raw key with a copy button.
 */
@Component({
	selector: 'mcms-generate-api-key-dialog',
	imports: [
		Button,
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Input,
		Label,
		Select,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { style: 'display: block; width: 100%' },
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Generate API Key</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				@if (generatedKey()) {
					<!-- Success: show the generated key -->
					<div class="space-y-4">
						<div
							class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
							role="alert"
						>
							This key will only be shown once. Copy it now.
						</div>
						<div>
							<mcms-label>API Key</mcms-label>
							<div class="mt-1.5 flex gap-2">
								<code
									class="flex-1 rounded-md border bg-muted px-3 py-2 text-sm font-mono break-all"
									data-testid="generated-api-key"
								>
									{{ generatedKey() }}
								</code>
								<button
									mcms-button
									variant="outline"
									size="sm"
									data-testid="copy-api-key"
									[attr.aria-label]="
										copied() ? 'API key copied to clipboard' : 'Copy API key to clipboard'
									"
									(click)="copyKey()"
								>
									{{ copied() ? 'Copied!' : 'Copy' }}
								</button>
							</div>
							<span class="sr-only" aria-live="polite">
								{{ copied() ? 'API key copied to clipboard' : '' }}
							</span>
						</div>
						@if (generatedKeyPrefix()) {
							<div class="text-sm text-muted-foreground">
								Key prefix: <code>{{ generatedKeyPrefix() }}</code>
							</div>
						}
					</div>
				} @else {
					<!-- Form: enter name and role -->
					<div class="space-y-4">
						<div>
							<mcms-label for="api-key-name">Key Name</mcms-label>
							<mcms-input
								id="api-key-name"
								placeholder="e.g. CI/CD Pipeline"
								[value]="name()"
								(valueChange)="name.set($event)"
								class="mt-1.5"
								data-testid="api-key-name-input"
							/>
						</div>
						<div>
							<mcms-label for="api-key-role">Role</mcms-label>
							<mcms-select
								id="api-key-role"
								[options]="roleOptions()"
								[value]="role()"
								(valueChange)="role.set($event)"
								class="mt-1.5"
								data-testid="api-key-role-select"
							/>
						</div>
						@if (errorMessage()) {
							<div
								class="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive"
								role="alert"
							>
								{{ errorMessage() }}
							</div>
						}
					</div>
				}
			</mcms-dialog-content>

			<mcms-dialog-footer>
				@if (generatedKey()) {
					<button
						mcms-button
						variant="primary"
						[mcmsDialogClose]="true"
						type="button"
						data-testid="api-key-done"
					>
						Done
					</button>
				} @else {
					<button mcms-button variant="outline" mcmsDialogClose type="button">Cancel</button>
					<button
						mcms-button
						variant="primary"
						type="button"
						[disabled]="!name().trim() || submitting()"
						data-testid="api-key-submit"
						(click)="submit()"
					>
						{{ submitting() ? 'Generating...' : 'Generate' }}
					</button>
				}
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class GenerateApiKeyDialog {
	private readonly data = inject<GenerateApiKeyDialogData>(DIALOG_DATA);
	private readonly http = inject(HttpClient);
	private readonly auth = inject(MomentumAuthService);
	private readonly doc = inject(DOCUMENT);

	/** Form state */
	readonly name = signal('');
	readonly role = signal('user');
	readonly submitting = signal(false);
	readonly errorMessage = signal('');

	/** Result state */
	readonly generatedKey = signal('');
	readonly generatedKeyPrefix = signal('');
	readonly copied = signal(false);

	/** Admins see all roles; non-admins see only their role level and below. */
	readonly roleOptions = computed<SelectOption[]>(() => {
		const userRole = this.auth.role() ?? 'viewer';
		if (userRole === 'admin') return ROLE_HIERARCHY;
		const idx = ROLE_HIERARCHY.findIndex((r) => r.value === userRole);
		return idx >= 0 ? ROLE_HIERARCHY.slice(idx) : ROLE_HIERARCHY.slice(-1);
	});

	async submit(): Promise<void> {
		const trimmedName = this.name().trim();
		if (!trimmedName) return;

		this.submitting.set(true);
		this.errorMessage.set('');

		try {
			const response = await firstValueFrom(
				this.http.post<ApiKeyCreateResponse>(this.data.endpoint, {
					name: trimmedName,
					role: this.role(),
				}),
			);

			this.generatedKey.set(response.key);
			this.generatedKeyPrefix.set(response.keyPrefix);
		} catch {
			this.errorMessage.set('Failed to generate API key. Please try again.');
		} finally {
			this.submitting.set(false);
		}
	}

	async copyKey(): Promise<void> {
		try {
			await this.doc.defaultView?.navigator.clipboard.writeText(this.generatedKey());
			this.copied.set(true);
			this.doc.defaultView?.setTimeout(() => this.copied.set(false), 2000);
		} catch {
			// Clipboard API not available, user can manually copy
		}
	}
}
