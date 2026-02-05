import {
	ChangeDetectionStrategy,
	Component,
	computed,
	forwardRef,
	input,
	output,
} from '@angular/core';
import { Card, CardHeader, CardTitle, CardContent } from '@momentum-cms/ui';
import type { Field } from '@momentum-cms/core';
import type { EntityFormMode, FieldChangeEvent } from '../entity-form.types';
import { isRecord } from '../entity-form.types';
import { FieldRenderer } from './field-renderer.component';

/**
 * Group field renderer.
 *
 * Renders a group of sub-fields inside a bordered card section.
 * Sub-fields emit change events with nested paths (e.g., "seo.metaTitle").
 */
@Component({
	selector: 'mcms-group-field-renderer',
	imports: [Card, CardHeader, CardTitle, CardContent, forwardRef(() => FieldRenderer)],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<mcms-card>
			<mcms-card-header>
				<mcms-card-title>{{ label() }}</mcms-card-title>
				@if (description()) {
					<p class="text-sm text-muted-foreground">{{ description() }}</p>
				}
			</mcms-card-header>
			<mcms-card-content>
				<div class="space-y-4">
					@for (subField of subFields(); track subField.name) {
						<mcms-field-renderer
							[field]="subField"
							[value]="getSubFieldValue(subField.name)"
							[mode]="mode()"
							[path]="getSubFieldPath(subField.name)"
							[error]="undefined"
							(fieldChange)="fieldChange.emit($event)"
						/>
					}
				</div>
			</mcms-card-content>
		</mcms-card>
	`,
})
export class GroupFieldRenderer {
	/** Field definition (must be a GroupField) */
	readonly field = input.required<Field>();

	/** Current value (should be an object with sub-field values) */
	readonly value = input<unknown>(null);

	/** Form mode */
	readonly mode = input<EntityFormMode>('create');

	/** Field path (e.g., "seo") */
	readonly path = input.required<string>();

	/** Field error */
	readonly error = input<string | undefined>(undefined);

	/** Field change event - forwarded from sub-field renderers */
	readonly fieldChange = output<FieldChangeEvent>();

	/** Computed label */
	readonly label = computed(() => this.field().label || this.field().name);

	/** Computed description */
	readonly description = computed(() => this.field().description || '');

	/** Sub-fields from the group definition */
	readonly subFields = computed((): Field[] => {
		const f = this.field();
		if (f.type === 'group') {
			return f.fields.filter((sf) => !sf.admin?.hidden);
		}
		return [];
	});

	/** Object value for the group */
	private readonly objectValue = computed((): Record<string, unknown> => {
		const val = this.value();
		return isRecord(val) ? val : {};
	});

	/** Get value for a sub-field */
	getSubFieldValue(subFieldName: string): unknown {
		return this.objectValue()[subFieldName] ?? null;
	}

	/** Get the full path for a sub-field (e.g., "seo.metaTitle") */
	getSubFieldPath(subFieldName: string): string {
		return `${this.path()}.${subFieldName}`;
	}
}
