/**
 * Tracking Rule Form Dialog
 *
 * Create / Edit dialog for tracking rules.
 * Opened via DialogService from the tracking rules page.
 * Uses standard Momentum collection REST API for persistence.
 */

import {
	Component,
	ChangeDetectionStrategy,
	inject,
	signal,
	computed,
	PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import {
	Dialog,
	DialogHeader,
	DialogTitle,
	DialogContent,
	DialogFooter,
	DialogClose,
	DIALOG_DATA,
	DialogRef,
	Input,
	Select,
	Switch,
	Button,
	McmsFormField,
} from '@momentumcms/ui';

/** Data passed to the dialog via DIALOG_DATA. */
export interface TrackingRuleFormData {
	mode: 'create' | 'edit';
	rule?: TrackingRuleEntry;
}

import { isRecord } from '../utils/type-guards';

/** Shape of a tracking rule entry as returned by the collection API. */
export interface TrackingRuleEntry {
	id: string;
	name: string;
	selector: string;
	eventType: string;
	eventName: string;
	urlPattern: string;
	active: boolean;
	rateLimit?: number;
	properties?: Record<string, unknown>;
}

const EVENT_TYPE_OPTIONS = [
	{ label: 'Click', value: 'click' },
	{ label: 'Submit', value: 'submit' },
	{ label: 'Scroll Into View', value: 'scroll-into-view' },
	{ label: 'Hover', value: 'hover' },
	{ label: 'Focus', value: 'focus' },
];

@Component({
	selector: 'mcms-tracking-rule-form-dialog',
	imports: [
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogContent,
		DialogFooter,
		DialogClose,
		Input,
		Select,
		Switch,
		Button,
		McmsFormField,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>
					{{ data.mode === 'create' ? 'Create Tracking Rule' : 'Edit Tracking Rule' }}
				</mcms-dialog-title>
			</mcms-dialog-header>

			<mcms-dialog-content>
				<div class="space-y-4">
					<mcms-form-field id="rule-name" [required]="true">
						<span mcmsLabel>Rule Name</span>
						<mcms-input
							[(value)]="name"
							placeholder="e.g. CTA Button Click"
							id="rule-name"
							[attr.aria-invalid]="submitted() && name().trim().length === 0"
							[attr.aria-describedby]="
								submitted() && name().trim().length === 0 ? 'rule-name-error' : null
							"
						/>
						@if (submitted() && name().trim().length === 0) {
							<span id="rule-name-error" class="text-sm text-destructive mt-1"
								>Rule Name is required</span
							>
						}
					</mcms-form-field>

					<mcms-form-field id="rule-selector" [required]="true">
						<span mcmsLabel>CSS Selector</span>
						<mcms-input
							[(value)]="selector"
							placeholder="e.g. .cta-button, #signup-form"
							id="rule-selector"
							[attr.aria-invalid]="submitted() && selector().trim().length === 0"
							[attr.aria-describedby]="
								submitted() && selector().trim().length === 0 ? 'rule-selector-error' : null
							"
						/>
						@if (submitted() && selector().trim().length === 0) {
							<span id="rule-selector-error" class="text-sm text-destructive mt-1"
								>CSS Selector is required</span
							>
						}
					</mcms-form-field>

					<mcms-form-field id="rule-event-type" [required]="true">
						<span mcmsLabel>Event Type</span>
						<mcms-select [(value)]="eventType" [options]="eventTypeOptions" id="rule-event-type" />
					</mcms-form-field>

					<mcms-form-field id="rule-event-name" [required]="true">
						<span mcmsLabel>Event Name</span>
						<mcms-input
							[(value)]="eventName"
							placeholder="e.g. cta_click"
							id="rule-event-name"
							[attr.aria-invalid]="submitted() && eventName().trim().length === 0"
							[attr.aria-describedby]="
								submitted() && eventName().trim().length === 0 ? 'rule-event-name-error' : null
							"
						/>
						@if (submitted() && eventName().trim().length === 0) {
							<span id="rule-event-name-error" class="text-sm text-destructive mt-1"
								>Event Name is required</span
							>
						}
					</mcms-form-field>

					<mcms-form-field id="rule-url-pattern" [hint]="'Use * for wildcards, e.g. /blog/*'">
						<span mcmsLabel>URL Pattern</span>
						<mcms-input [(value)]="urlPattern" placeholder="*" id="rule-url-pattern" />
					</mcms-form-field>

					<mcms-form-field
						id="rule-rate-limit"
						[hint]="'Max events per minute per visitor. Leave empty for unlimited.'"
					>
						<span mcmsLabel>Rate Limit</span>
						<mcms-input
							[(value)]="rateLimitStr"
							type="number"
							placeholder="Optional"
							id="rule-rate-limit"
						/>
					</mcms-form-field>

					<mcms-form-field
						id="rule-properties"
						[hint]="'JSON object, e.g. {&quot;category&quot;: &quot;cta&quot;}'"
					>
						<span mcmsLabel>Static Properties</span>
						<mcms-input [(value)]="propertiesStr" placeholder="{}" id="rule-properties" />
					</mcms-form-field>

					<div class="pt-2">
						<mcms-switch [(value)]="active">Active</mcms-switch>
					</div>
				</div>
			</mcms-dialog-content>

			<mcms-dialog-footer>
				<button mcms-button variant="outline" mcmsDialogClose>Cancel</button>
				<button mcms-button [disabled]="!isValid()" [loading]="saving()" (click)="save()">
					{{ data.mode === 'create' ? 'Create' : 'Save' }}
				</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
export class TrackingRuleFormDialog {
	readonly data = inject<TrackingRuleFormData>(DIALOG_DATA);
	private readonly dialogRef = inject(DialogRef);
	private readonly platformId = inject(PLATFORM_ID);

	readonly name = signal(this.data.rule?.name ?? '');
	readonly selector = signal(this.data.rule?.selector ?? '');
	readonly eventType = signal(this.data.rule?.eventType ?? 'click');
	readonly eventName = signal(this.data.rule?.eventName ?? '');
	readonly urlPattern = signal(this.data.rule?.urlPattern ?? '*');
	readonly active = signal(this.data.rule?.active ?? true);
	readonly rateLimitStr = signal(this.data.rule?.rateLimit?.toString() ?? '');
	readonly propertiesStr = signal(
		this.data.rule?.properties && Object.keys(this.data.rule.properties).length > 0
			? JSON.stringify(this.data.rule.properties)
			: '',
	);
	readonly saving = signal(false);
	readonly submitted = signal(false);

	readonly eventTypeOptions = EVENT_TYPE_OPTIONS;

	readonly isValid = computed(
		(): boolean =>
			this.name().trim().length > 0 &&
			this.selector().trim().length > 0 &&
			this.eventName().trim().length > 0,
	);

	async save(): Promise<void> {
		this.submitted.set(true);
		if (!this.isValid() || this.saving()) return;
		if (!isPlatformBrowser(this.platformId)) return;

		this.saving.set(true);

		let properties: Record<string, unknown> = {};
		const propsStr = this.propertiesStr().trim();
		if (propsStr) {
			try {
				const parsed: unknown = JSON.parse(propsStr);
				if (isRecord(parsed)) {
					properties = parsed;
				}
			} catch {
				// invalid JSON — use empty object
			}
		}

		const rateLimitVal = this.rateLimitStr().trim();
		const body: Record<string, unknown> = {
			name: this.name().trim(),
			selector: this.selector().trim(),
			eventType: this.eventType(),
			eventName: this.eventName().trim(),
			urlPattern: this.urlPattern().trim() || '*',
			active: this.active(),
			properties,
		};

		if (rateLimitVal && !Number.isNaN(Number(rateLimitVal))) {
			body['rateLimit'] = Number(rateLimitVal);
		}

		try {
			if (this.data.mode === 'edit' && this.data.rule) {
				await fetch(`/api/tracking-rules/${this.data.rule.id}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
			} else {
				await fetch('/api/tracking-rules', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body),
				});
			}
			this.dialogRef.close('saved');
		} finally {
			this.saving.set(false);
		}
	}
}
