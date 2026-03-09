import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
	HdlAccordion,
	HdlAccordionContent,
	HdlAccordionItem,
	HdlAccordionTrigger,
	HdlAlertDialog,
	HdlAlertDialogAction,
	HdlAlertDialogCancel,
	HdlAlertDialogDescription,
	HdlAlertDialogTitle,
	HdlCheckbox,
	HdlChip,
	HdlChipInput,
	HdlChipRemove,
	HdlChips,
	HdlCollapsible,
	HdlCollapsibleContent,
	HdlCollapsibleTrigger,
	HdlCombobox,
	HdlComboboxInput,
	HdlComboboxPopup,
	HdlCommand,
	HdlCommandEmpty,
	HdlCommandGroup,
	HdlCommandInput,
	HdlCommandItem,
	HdlCommandList,
	HdlCommandSeparator,
	HdlCommandDialog,
	HdlContextMenuContent,
	HdlContextMenuTrigger,
	HdlDescription,
	HdlDialog,
	HdlDialogClose,
	HdlDialogDescription,
	HdlDialogService,
	HdlDialogTitle,
	HdlDrawer,
	HdlDrawerClose,
	HdlDrawerDescription,
	HdlDrawerService,
	HdlDrawerTitle,
	HdlError,
	HdlField,
	HdlGrid,
	HdlGridCell,
	HdlGridRow,
	HdlHoverCardContent,
	HdlHoverCardTrigger,
	HdlInput,
	HdlLabel,
	HdlListbox,
	HdlMenu,
	HdlMenuBar,
	HdlMenuItem,
	HdlMenuTrigger,
	HdlOption,
	HdlPopoverContent,
	HdlPopoverTrigger,
	HdlProgress,
	HdlRadioGroup,
	HdlRadioItem,
	HdlSelect,
	HdlSelectContent,
	HdlSelectItem,
	HdlSelectTrigger,
	HdlSelectValue,
	HdlSeparator,
	HdlSkeleton,
	HdlSpinner,
	HdlSwitch,
	HdlTab,
	HdlTabList,
	HdlTabPanel,
	HdlTabs,
	HdlTextarea,
	HdlToastContainer,
	HdlToastService,
	HdlToolbar,
	HdlToolbarWidget,
	HdlToolbarWidgetGroup,
	HdlToggle,
	HdlToggleGroup,
	HdlToggleItem,
	HdlTooltipTrigger,
	HdlTree,
	HdlTreeItem,
	HdlTreeItemGroup,
} from '@momentumcms/headless';

@Component({
	imports: [HdlDialog, HdlDialogTitle, HdlDialogDescription, HdlDialogClose],
	template: `
		<hdl-dialog data-testid="dialog-surface">
			<div class="space-y-4">
				<div class="space-y-2">
					<hdl-dialog-title data-testid="dialog-title">Global dialog styling</hdl-dialog-title>
					<hdl-dialog-description>
						This panel is styled entirely from the app's global layer.
					</hdl-dialog-description>
				</div>
				<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
					The backdrop, panel, title, and close button all use the stable headless selectors.
				</p>
				<div class="flex justify-end">
					<button hdlDialogClose type="button" data-testid="dialog-close" class="lab-trigger">
						Close
					</button>
				</div>
			</div>
		</hdl-dialog>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeadlessStylingLabDialogComponent {}

@Component({
	imports: [
		HdlAlertDialog,
		HdlAlertDialogTitle,
		HdlAlertDialogDescription,
		HdlAlertDialogAction,
		HdlAlertDialogCancel,
	],
	template: `
		<hdl-alert-dialog data-testid="alert-dialog-surface">
			<div class="space-y-4">
				<div class="space-y-2">
					<hdl-alert-dialog-title>Delete the current preview?</hdl-alert-dialog-title>
					<hdl-alert-dialog-description>
						This proves the confirm flow can use a distinct alert-dialog host while still leaning on
						the shared overlay service.
					</hdl-alert-dialog-description>
				</div>
				<div class="flex justify-end gap-3">
					<button hdlAlertDialogCancel type="button" class="lab-trigger" data-testid="alert-cancel">
						Cancel
					</button>
					<button
						hdlAlertDialogAction
						type="button"
						class="lab-trigger"
						data-testid="alert-confirm"
					>
						Delete preview
					</button>
				</div>
			</div>
		</hdl-alert-dialog>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeadlessStylingLabAlertDialogComponent {}

@Component({
	imports: [HdlDrawer, HdlDrawerTitle, HdlDrawerDescription, HdlDrawerClose],
	template: `
		<hdl-drawer side="right" data-testid="drawer-surface">
			<div class="space-y-4 p-6">
				<div class="space-y-2">
					<hdl-drawer-title>Saved views</hdl-drawer-title>
					<hdl-drawer-description>
						Drawers use their own overlay classes, side tokens, and focus trap instead of pretending
						a dialog centered itself by accident.
					</hdl-drawer-description>
				</div>
				<div class="space-y-2 text-sm" style="color: var(--hdl-lab-text-muted);">
					<p>Editorial Queue</p>
					<p>Landing Page Audit</p>
					<p>Release Checklist</p>
				</div>
				<div class="flex justify-end">
					<button hdlDrawerClose type="button" class="lab-trigger" data-testid="drawer-close">
						Close drawer
					</button>
				</div>
			</div>
		</hdl-drawer>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class HeadlessStylingLabDrawerComponent {}

type PrimitiveOption = {
	label: string;
	value: string;
};

type PrimitiveCoverage = {
	slug: string;
	label: string;
	intent: string;
	anchor: string;
	sectionLabel: string;
};

@Component({
	imports: [
		HdlAccordion,
		HdlAccordionContent,
		HdlAccordionItem,
		HdlAccordionTrigger,
		HdlCheckbox,
		HdlChip,
		HdlChipInput,
		HdlChipRemove,
		HdlChips,
		HdlCollapsible,
		HdlCollapsibleContent,
		HdlCollapsibleTrigger,
		HdlCombobox,
		HdlComboboxInput,
		HdlComboboxPopup,
		HdlCommand,
		HdlCommandEmpty,
		HdlCommandGroup,
		HdlCommandInput,
		HdlCommandItem,
		HdlCommandList,
		HdlCommandSeparator,
		HdlCommandDialog,
		HdlContextMenuContent,
		HdlContextMenuTrigger,
		HdlDescription,
		HdlError,
		HdlField,
		HdlGrid,
		HdlGridCell,
		HdlGridRow,
		HdlHoverCardContent,
		HdlHoverCardTrigger,
		HdlInput,
		HdlLabel,
		HdlListbox,
		HdlMenu,
		HdlMenuBar,
		HdlMenuItem,
		HdlMenuTrigger,
		HdlOption,
		HdlPopoverTrigger,
		HdlPopoverContent,
		HdlProgress,
		HdlRadioGroup,
		HdlRadioItem,
		HdlSelect,
		HdlSelectContent,
		HdlSelectItem,
		HdlSelectTrigger,
		HdlSelectValue,
		HdlSeparator,
		HdlSkeleton,
		HdlSpinner,
		HdlSwitch,
		HdlTabs,
		HdlTabList,
		HdlTab,
		HdlTabPanel,
		HdlTextarea,
		HdlToastContainer,
		HdlToolbar,
		HdlToolbarWidget,
		HdlToolbarWidgetGroup,
		HdlToggle,
		HdlToggleGroup,
		HdlToggleItem,
		HdlTooltipTrigger,
		HdlTree,
		HdlTreeItem,
		HdlTreeItemGroup,
	],
	template: `
		<main
			data-headless-demo
			class="mx-auto flex min-h-screen max-w-7xl flex-col gap-10 px-6 py-12 lg:px-10"
		>
			<header class="space-y-4">
				<p
					class="inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em]"
					style="border-color: var(--hdl-lab-border); background-color: var(--hdl-lab-muted); color: var(--hdl-lab-accent-strong);"
				>
					Headless Styling Lab
				</p>
				<div class="max-w-4xl space-y-3">
					<h1 class="text-4xl font-black tracking-tight sm:text-5xl">
						Global recipes, scoped theme overrides, and a full primitive harness
					</h1>
					<p class="text-lg leading-8" style="color: var(--hdl-lab-text-muted);">
						This page exists to prove the headless primitives can be themed from one global layer,
						survive dark mode, and still accept one-off overrides without turning into a cursed CSS
						pile.
					</p>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<button
						type="button"
						data-testid="lab-theme-toggle"
						(click)="toggleTheme()"
						class="lab-trigger"
					>
						Toggle {{ themeMode() === 'light' ? 'dark' : 'light' }} mode
					</button>
					<p
						class="text-sm leading-6"
						style="color: var(--hdl-lab-text-muted);"
						data-testid="lab-theme-state"
					>
						Active theme: {{ themeMode() }}
					</p>
				</div>
			</header>

			<section
				id="primitive-coverage"
				data-headless-card
				class="rounded-[2rem] border p-6"
				data-testid="primitive-coverage-card"
			>
				<div class="space-y-5">
					<div class="space-y-2">
						<h2 class="text-2xl font-bold">Coverage Matrix</h2>
						<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
							All {{ primitiveCoverage.length }} currently exported headless primitive families are
							shown here first, and each one has a matching browser assertion for the intended
							interaction, not just a decorative screenshot.
						</p>
						<p
							class="text-sm leading-6"
							style="color: var(--hdl-lab-text-muted);"
							data-testid="coverage-current-scope"
						>
							Form foundations are part of the exported surface now too: field semantics, input,
							textarea, and chips all have live demos with visible outcomes instead of getting
							quietly hand-waved away.
						</p>
					</div>
					<div data-headless-coverage-grid>
						@for (primitive of primitiveCoverage; track primitive.slug) {
							<div class="lab-coverage-card" [attr.data-testid]="'inventory-' + primitive.slug">
								<span class="lab-coverage-label">{{ primitive.label }}</span>
								<span class="lab-coverage-intent">{{ primitive.intent }}</span>
								<span class="lab-coverage-meta">Shown in {{ primitive.sectionLabel }}</span>
							</div>
						}
					</div>
				</div>
			</section>

			<section id="global-layer" class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
				<article
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="global-recipes-card"
				>
					<div class="space-y-4">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Global Layer</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								These primitives only receive classes on layout wrappers. Switches, tabs, dialogs,
								popovers, tooltips, and toasts all pull their look from the global selectors.
							</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Switch
								</p>
								<hdl-switch
									[(value)]="globalSwitchEnabled"
									data-testid="global-switch"
									aria-label="Global switch"
								>
									<span class="headless-thumb"></span>
								</hdl-switch>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="global-switch-state"
								>
									Global switch: {{ globalSwitchEnabled ? 'on' : 'off' }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Overlay Triggers
								</p>
								<div class="flex flex-wrap gap-3">
									<button
										type="button"
										data-testid="dialog-trigger"
										(click)="openDialog()"
										class="lab-trigger"
									>
										Open dialog
									</button>
									<button
										type="button"
										data-testid="popover-trigger"
										[hdlPopoverTrigger]="popoverTemplate"
										class="lab-trigger"
									>
										Open popover
									</button>
									<button
										type="button"
										data-testid="tooltip-trigger"
										hdlTooltip="Tooltips can be themed globally too."
										[tooltipDelay]="0"
										class="lab-trigger"
									>
										Hover or focus tooltip
									</button>
									<button
										type="button"
										data-testid="toast-trigger"
										(click)="showToast()"
										class="lab-trigger"
									>
										Show toast
									</button>
								</div>
								<ng-template #popoverTemplate>
									<hdl-popover-content data-testid="popover-content">
										<div class="space-y-2">
											<p class="text-sm font-semibold">Popover styling</p>
											<p class="text-sm" style="color: var(--hdl-lab-text-muted);">
												The panel and content are styled from the global layer.
											</p>
										</div>
									</hdl-popover-content>
								</ng-template>
							</div>
						</div>

						<div class="space-y-4">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Tabs
							</p>
							<hdl-tabs data-testid="global-tabs">
								<hdl-tab-list [(selectedTab)]="selectedGlobalTab">
									<hdl-tab value="overview" data-testid="global-tab-overview">Overview</hdl-tab>
									<hdl-tab value="tokens" data-testid="global-tab-tokens">Tokens</hdl-tab>
								</hdl-tab-list>
								<hdl-tab-panel value="overview" data-testid="global-tab-panel-overview">
									<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
										Global recipes target the headless slots instead of private markup.
									</p>
								</hdl-tab-panel>
								<hdl-tab-panel value="tokens" data-testid="global-tab-panel-tokens">
									<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
										State selectors like <code>data-state</code> keep the recipes explicit.
									</p>
								</hdl-tab-panel>
							</hdl-tabs>
							<p
								class="text-sm leading-6"
								style="color: var(--hdl-lab-text-muted);"
								data-testid="global-tab-selection"
							>
								Active tab: {{ selectedGlobalTab }}
							</p>
						</div>
					</div>
				</article>

				<div class="grid gap-6">
					<article
						data-headless-card
						data-headless-theme="berry"
						class="rounded-[2rem] border p-6"
						data-testid="scoped-override-card"
					>
						<div class="space-y-4">
							<div class="space-y-2">
								<h2 class="text-2xl font-bold">Scoped Override</h2>
								<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
									This wrapper swaps the accent tokens without changing the primitive markup.
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Scoped switch
								</p>
								<hdl-switch
									[(value)]="scopedSwitchEnabled"
									data-testid="scoped-switch"
									aria-label="Scoped switch"
								>
									<span class="headless-thumb"></span>
								</hdl-switch>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="scoped-switch-state"
								>
									Scoped switch: {{ scopedSwitchEnabled ? 'on' : 'off' }}
								</p>
							</div>

							<hdl-tabs>
								<hdl-tab-list [(selectedTab)]="selectedScopedTab">
									<hdl-tab value="berry-a" data-testid="scoped-tab-berry">Berry</hdl-tab>
									<hdl-tab value="berry-b" data-testid="scoped-tab-contrast">Contrast</hdl-tab>
								</hdl-tab-list>
								<hdl-tab-panel value="berry-a" data-testid="scoped-tab-panel-berry">
									<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
										The selected tab inherits the scoped berry accent.
									</p>
								</hdl-tab-panel>
								<hdl-tab-panel value="berry-b" data-testid="scoped-tab-panel-contrast">
									<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
										Same primitive, different token scope, no component rewrite.
									</p>
								</hdl-tab-panel>
							</hdl-tabs>
						</div>
					</article>

					<article
						data-headless-card
						class="rounded-[2rem] border p-6"
						data-testid="adhoc-override-card"
					>
						<div class="space-y-4">
							<div class="space-y-2">
								<h2 class="text-2xl font-bold">Ad Hoc Override</h2>
								<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
									This switch only changes host-scoped tokens and geometry. No private markup, no
									broken thumb, no excuses.
								</p>
							</div>
							<hdl-switch
								[(value)]="adhocSwitchEnabled"
								class="lab-switch--adhoc"
								data-testid="adhoc-switch"
								aria-label="Ad hoc switch"
							>
								<span class="headless-thumb"></span>
							</hdl-switch>
							<p
								class="text-sm leading-6"
								style="color: var(--hdl-lab-text-muted);"
								data-testid="adhoc-switch-state"
							>
								Ad hoc switch: {{ adhocSwitchEnabled ? 'on' : 'off' }}
							</p>
						</div>
					</article>
				</div>
			</section>

			<section id="form-foundations" class="grid gap-6">
				<article
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="form-foundations-card"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Form Foundations</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								Field semantics, text inputs, textareas, and chips now ship as real headless
								primitives. Labels, descriptions, errors, and live values all stay in sync from the
								same global layer.
							</p>
						</div>

						<div class="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
							<div class="space-y-4">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Field + Input
								</p>
								<hdl-field
									[invalid]="displayName.trim().length === 0"
									[required]="true"
									data-testid="field-demo"
								>
									<hdl-label>Display name</hdl-label>
									<input
										hdl-input
										data-testid="field-input"
										class="lab-field"
										placeholder="Type a public author name"
										[value]="displayName"
										(input)="updateDisplayName($event)"
									/>
									<hdl-description data-testid="field-description">
										Used in author bylines, profile cards, and inline mentions.
									</hdl-description>
									@if (displayName.trim().length === 0) {
										<hdl-error data-testid="field-error">Display name is required.</hdl-error>
									}
								</hdl-field>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="field-state"
								>
									Display name: {{ displayName || 'empty' }}
								</p>
							</div>

							<div class="space-y-4">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Textarea
								</p>
								<hdl-field data-testid="textarea-demo">
									<hdl-label>Editorial notes</hdl-label>
									<textarea
										hdl-textarea
										data-testid="textarea-input"
										class="lab-field lab-field--area"
										rows="4"
										placeholder="Internal notes for reviewers..."
										[value]="editorialNotes"
										(input)="updateEditorialNotes($event)"
									></textarea>
									<hdl-description data-testid="textarea-description">
										Internal notes stay out of public output, but the field still needs accessible
										semantics.
									</hdl-description>
								</hdl-field>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="textarea-state"
								>
									Notes length: {{ editorialNotes.length }}
								</p>
							</div>
						</div>

						<div class="space-y-4">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Chips
							</p>
							<hdl-field data-testid="chips-demo">
								<hdl-label>Tags</hdl-label>
								<hdl-description data-testid="chips-description">
									Press <kbd>Enter</kbd> or comma to add a tag. Backspace from an empty input
									removes the last chip.
								</hdl-description>
								<hdl-chips [(values)]="chipValues" data-testid="chips-list">
									@for (value of chipValues; track value) {
										<hdl-chip [value]="value">
											<span>{{ value }}</span>
											<button hdlChipRemove type="button" [attr.aria-label]="'Remove ' + value">
												Remove
											</button>
										</hdl-chip>
									}
									<input
										hdl-chip-input
										data-testid="chips-input"
										placeholder="Add tag"
										class="lab-field--chip-input"
									/>
								</hdl-chips>
							</hdl-field>
							<p
								class="text-sm leading-6"
								style="color: var(--hdl-lab-text-muted);"
								data-testid="chips-state"
							>
								Tags: {{ chipValues.join(', ') }}
							</p>
						</div>
					</div>
				</article>
			</section>

			<section id="selection-primitives" class="grid gap-6 xl:grid-cols-2">
				<article
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="selection-primitives-card"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Selection Primitives</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								Accordion, checkbox, radio, listbox, and combobox all use the same global recipe
								language instead of bespoke component CSS.
							</p>
						</div>

						<div class="space-y-4">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Accordion
							</p>
							<hdl-accordion data-testid="accordion-demo">
								<hdl-accordion-item>
									<hdl-accordion-trigger
										panelId="accordion-install"
										data-testid="accordion-trigger-install"
										[(expanded)]="accordionInstallExpanded"
									>
										<span>Installation</span>
										<span class="text-xs uppercase tracking-[0.2em]">
											{{ accordionInstallExpanded ? 'Open' : 'Closed' }}
										</span>
									</hdl-accordion-trigger>
									<hdl-accordion-content
										panelId="accordion-install"
										data-testid="accordion-content-install"
									>
										Start with the global slot recipes, then layer tokens and local wrapper themes
										on top.
									</hdl-accordion-content>
								</hdl-accordion-item>
								<hdl-accordion-item>
									<hdl-accordion-trigger
										panelId="accordion-contract"
										data-testid="accordion-trigger-contract"
										[(expanded)]="accordionContractExpanded"
									>
										<span>Styling contract</span>
										<span class="text-xs uppercase tracking-[0.2em]">
											{{ accordionContractExpanded ? 'Open' : 'Closed' }}
										</span>
									</hdl-accordion-trigger>
									<hdl-accordion-content
										panelId="accordion-contract"
										data-testid="accordion-content-contract"
									>
										Hidden content stays hidden because the global layer respects native
										<code>[hidden]</code> instead of stomping it.
									</hdl-accordion-content>
								</hdl-accordion-item>
							</hdl-accordion>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Checkbox
								</p>
								<div class="flex flex-wrap gap-3">
									<hdl-checkbox [(value)]="checkboxPublishReady" data-testid="checkbox-default">
										Publish ready
									</hdl-checkbox>
									<hdl-checkbox [(value)]="checkboxFeatured" data-testid="checkbox-featured">
										Featured
									</hdl-checkbox>
									<hdl-checkbox [indeterminate]="true" data-testid="checkbox-indeterminate">
										Needs review
									</hdl-checkbox>
								</div>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="checkbox-state"
								>
									Checkboxes: publish ready {{ checkboxPublishReady ? 'yes' : 'no' }}, featured
									{{ checkboxFeatured ? 'yes' : 'no' }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Radio Group
								</p>
								<hdl-radio-group
									[(value)]="radioDensity"
									data-testid="radio-group-demo"
									class="flex flex-wrap gap-3"
								>
									<hdl-radio-item value="comfortable" data-testid="radio-density-comfortable">
										Comfortable
									</hdl-radio-item>
									<hdl-radio-item value="compact" data-testid="radio-density-compact">
										Compact
									</hdl-radio-item>
									<hdl-radio-item value="minimal" data-testid="radio-density-minimal">
										Minimal
									</hdl-radio-item>
								</hdl-radio-group>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="radio-density-state"
								>
									Current density: {{ radioDensity }}
								</p>
							</div>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Listbox
								</p>
								<hdl-listbox [(values)]="listboxValues" data-testid="listbox-demo">
									<hdl-option value="tokens" data-testid="listbox-option-tokens">Tokens</hdl-option>
									<hdl-option value="states" data-testid="listbox-option-states">States</hdl-option>
									<hdl-option value="overlays" data-testid="listbox-option-overlays"
										>Overlays</hdl-option
									>
								</hdl-listbox>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="listbox-selection"
								>
									Listbox selection: {{ listboxValues.join(', ') }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Combobox
								</p>
								<hdl-combobox [alwaysExpanded]="true" data-testid="combobox-demo">
									<input
										hdl-combobox-input
										data-testid="combobox-input"
										class="lab-field"
										placeholder="Show all primitives, then filter..."
										[value]="comboboxQuery()"
										(input)="updateComboboxQuery($event)"
									/>
									<hdl-combobox-popup data-testid="combobox-popup">
										<div class="space-y-2">
											@for (option of filteredComboboxOptions(); track option.value) {
												<button
													type="button"
													class="w-full rounded-xl px-3 py-2 text-left text-sm transition"
													style="background-color: var(--hdl-lab-muted-soft);"
													(click)="selectComboboxOption(option)"
													[attr.data-testid]="'combobox-option-' + option.value"
													[attr.data-selected]="
														comboboxSelection() === option.value ? 'true' : null
													"
												>
													{{ option.label }}
												</button>
											} @empty {
												<p
													class="rounded-xl px-3 py-2 text-sm"
													style="background-color: var(--hdl-lab-muted-soft); color: var(--hdl-lab-text-muted);"
													data-testid="combobox-empty"
												>
													No primitives match this filter.
												</p>
											}
										</div>
									</hdl-combobox-popup>
								</hdl-combobox>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="combobox-filter-state"
								>
									Filter query: {{ comboboxQuery() || 'all primitives' }}. Matches:
									{{ filteredComboboxOptions().length }}
								</p>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="combobox-selection"
								>
									Combobox selection: {{ comboboxSelection() }}
								</p>
							</div>
						</div>
					</div>
				</article>

				<article
					id="navigation-primitives"
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="navigation-primitives-card"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Navigation and Data Primitives</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								Tree, grid, menu, and toolbar primitives all sit under the same tokenized global
								layer, because consistency should not require ceremony.
							</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Tree
								</p>
								<hdl-tree #contentTree="hdlTree" [(values)]="treeValues" data-testid="tree-demo">
									<hdl-tree-item
										[parent]="contentTree.ariaDirective"
										value="content"
										label="Content"
										data-testid="tree-item-content"
										[(expanded)]="treeContentExpanded"
										#contentItem="hdlTreeItem"
									>
										Content
									</hdl-tree-item>
									<hdl-tree-item-group
										[ownedBy]="contentItem.treeItem"
										data-testid="tree-group-content"
									>
										<div
											data-testid="tree-group-note"
											class="rounded-xl px-3 py-2 text-sm"
											style="background-color: var(--hdl-lab-muted-soft); color: var(--hdl-lab-text-muted);"
										>
											Tree groups project nested items once the owner node expands.
										</div>
									</hdl-tree-item-group>
									<hdl-tree-item
										[parent]="contentTree.ariaDirective"
										value="media"
										label="Media"
										data-testid="tree-item-media"
									>
										Media
									</hdl-tree-item>
									<hdl-tree-item
										[parent]="contentTree.ariaDirective"
										value="settings"
										label="Settings"
										data-testid="tree-item-settings"
									>
										Settings
									</hdl-tree-item>
								</hdl-tree>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="tree-selection"
								>
									Tree selection: {{ treeValues.join(', ') }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Grid
								</p>
								<hdl-grid [enableSelection]="true" data-testid="grid-demo">
									<hdl-grid-row>
										<hdl-grid-cell data-testid="grid-cell-title">Title</hdl-grid-cell>
										<hdl-grid-cell data-testid="grid-cell-status">Status</hdl-grid-cell>
									</hdl-grid-row>
									<hdl-grid-row>
										<hdl-grid-cell
											data-testid="grid-cell-post"
											(click)="gridSelection = 'launch plan'"
										>
											Launch plan
										</hdl-grid-cell>
										<hdl-grid-cell
											data-testid="grid-cell-published"
											(click)="gridSelection = 'published'"
										>
											Published
										</hdl-grid-cell>
									</hdl-grid-row>
								</hdl-grid>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="grid-selection"
								>
									Grid selection: {{ gridSelection }}
								</p>
							</div>
						</div>

						<div class="space-y-3">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Menu and Menu Bar
							</p>
							<div class="space-y-4">
								<hdl-menu-bar data-testid="menu-bar-demo">
									<hdl-menu-item
										value="content"
										data-testid="menu-bar-content"
										(click)="menuBarSelection = 'content'"
									>
										Content
									</hdl-menu-item>
									<hdl-menu-item
										value="media"
										data-testid="menu-bar-media"
										(click)="menuBarSelection = 'media'"
									>
										Media
									</hdl-menu-item>
									<hdl-menu-item
										value="settings"
										data-testid="menu-bar-settings"
										(click)="menuBarSelection = 'settings'"
									>
										Settings
									</hdl-menu-item>
								</hdl-menu-bar>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="menu-bar-selection"
								>
									Menu bar selection: {{ menuBarSelection }}
								</p>
								<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
									The menu bar uses roving focus and updates its current section. The Actions
									trigger opens a real popup menu and selecting an item updates the action readout
									below.
								</p>

								<div class="space-y-3">
									<hdl-menu-trigger
										[menu]="overflowMenu.ariaDirective"
										data-testid="menu-trigger"
										class="inline-flex"
									>
										Actions
									</hdl-menu-trigger>
									<hdl-menu #overflowMenu data-testid="menu-demo">
										<hdl-menu-item
											value="rename"
											data-testid="menu-item-rename"
											(click)="recordMenuAction('rename')"
										>
											Rename
										</hdl-menu-item>
										<hdl-menu-item
											value="duplicate"
											data-testid="menu-item-duplicate"
											(click)="recordMenuAction('duplicate')"
										>
											Duplicate
										</hdl-menu-item>
										<hdl-menu-item value="delete" [disabled]="true" data-testid="menu-item-delete">
											Delete
										</hdl-menu-item>
									</hdl-menu>
									<p
										class="text-sm leading-6"
										style="color: var(--hdl-lab-text-muted);"
										data-testid="menu-last-action"
									>
										Last menu action: {{ lastMenuAction }}
									</p>
								</div>
							</div>
						</div>

						<div class="space-y-3">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Toolbar
							</p>
							<hdl-toolbar [(values)]="toolbarValues" data-testid="toolbar-demo">
								<button hdl-toolbar-widget value="undo" data-testid="toolbar-undo">Undo</button>
								<button hdl-toolbar-widget value="redo" data-testid="toolbar-redo">Redo</button>
								<hdl-toolbar-widget-group [multi]="true">
									<button hdl-toolbar-widget value="bold" data-testid="toolbar-bold">Bold</button>
									<button hdl-toolbar-widget value="italic" data-testid="toolbar-italic">
										Italic
									</button>
									<button hdl-toolbar-widget value="underline" data-testid="toolbar-underline">
										Underline
									</button>
								</hdl-toolbar-widget-group>
							</hdl-toolbar>
							<p
								class="text-sm leading-6"
								style="color: var(--hdl-lab-text-muted);"
								data-testid="toolbar-selection"
							>
								Toolbar values: {{ toolbarValues.join(', ') }}
							</p>
						</div>
					</div>
				</article>
			</section>

			<section
				id="extended-primitives"
				class="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]"
				data-testid="extended-primitives-section"
			>
				<article
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="utility-primitives-card"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Utility and Command Primitives</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								These are the glue pieces that make real app UI possible: collapsible regions,
								toggle groups, select, command filtering, and structural feedback primitives.
							</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Collapsible
								</p>
								<hdl-collapsible [(open)]="collapsibleOpen" data-testid="collapsible-demo">
									<hdl-collapsible-trigger data-testid="collapsible-trigger">
										Editor metadata
									</hdl-collapsible-trigger>
									<hdl-collapsible-content data-testid="collapsible-content">
										Collapsible content keeps the hidden state explicit instead of relying on CSS
										vibes.
									</hdl-collapsible-content>
								</hdl-collapsible>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="collapsible-state"
								>
									Collapsible: {{ collapsibleOpen ? 'open' : 'closed' }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Toggle + Toggle Group
								</p>
								<div class="flex flex-wrap gap-3">
									<hdl-toggle [(pressed)]="soloToggleOn" data-testid="solo-toggle">
										Preview mode
									</hdl-toggle>
									<hdl-toggle-group
										[(values)]="toggleGroupValues"
										[multiple]="true"
										data-testid="toggle-group-demo"
									>
										<hdl-toggle-item value="bold" data-testid="toggle-item-bold"
											>Bold</hdl-toggle-item
										>
										<hdl-toggle-item value="italic" data-testid="toggle-item-italic"
											>Italic</hdl-toggle-item
										>
										<hdl-toggle-item value="underline" data-testid="toggle-item-underline"
											>Underline</hdl-toggle-item
										>
									</hdl-toggle-group>
								</div>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="toggle-state"
								>
									Toggle: {{ soloToggleOn ? 'on' : 'off' }}. Group:
									{{ toggleGroupValues.join(', ') }}
								</p>
							</div>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Select
								</p>
								<hdl-select [(value)]="selectValue" data-testid="select-demo">
									<hdl-select-trigger data-testid="select-trigger">
										<hdl-select-value placeholder="Choose workflow state" />
									</hdl-select-trigger>
									<hdl-select-content data-testid="select-content">
										<hdl-select-item value="draft" data-testid="select-item-draft"
											>Draft</hdl-select-item
										>
										<hdl-select-item value="review" data-testid="select-item-review"
											>In review</hdl-select-item
										>
										<hdl-select-item value="published" data-testid="select-item-published"
											>Published</hdl-select-item
										>
									</hdl-select-content>
								</hdl-select>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="select-state"
								>
									Select value: {{ selectValue || 'none' }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Command
								</p>
								<hdl-command [(value)]="commandSelection" data-testid="command-demo">
									<input
										hdlCommandInput
										data-testid="command-input"
										class="lab-field"
										placeholder="Filter command items..."
									/>
									<hdl-command-list data-testid="command-list">
										<hdl-command-empty data-testid="command-empty"
											>No command results.</hdl-command-empty
										>
										<hdl-command-group label="Content tools" data-testid="command-group-content">
											<p class="lab-command-label" data-testid="command-group-content-label">
												Content tools
											</p>
											<hdl-command-item value="articles" data-testid="command-item-articles">
												Articles
											</hdl-command-item>
											<hdl-command-item value="assets" data-testid="command-item-assets">
												Assets
											</hdl-command-item>
										</hdl-command-group>
										<hdl-command-separator data-testid="command-separator" />
										<hdl-command-group label="People" data-testid="command-group-people">
											<p class="lab-command-label" data-testid="command-group-people-label">
												People
											</p>
											<hdl-command-item value="authors" data-testid="command-item-authors">
												Authors
											</hdl-command-item>
										</hdl-command-group>
									</hdl-command-list>
								</hdl-command>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="command-state"
								>
									Command selection: {{ commandSelection || 'none' }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Command Dialog
								</p>
								<button
									type="button"
									class="lab-trigger"
									data-testid="command-dialog-trigger"
									(click)="commandDialogOpen.set(true)"
								>
									Open command palette
									<kbd
										class="ml-2 rounded border px-1.5 py-0.5 text-xs"
										style="border-color: var(--hdl-lab-border); color: var(--hdl-lab-text-muted);"
										>⌘K</kbd
									>
								</button>
								<hdl-command-dialog [(open)]="commandDialogOpen" data-testid="command-dialog">
									<hdl-command
										[(value)]="commandDialogSelection"
										(valueChange)="commandDialogOpen.set(false)"
										data-testid="command-dialog-command"
									>
										<input
											hdlCommandInput
											data-testid="command-dialog-input"
											class="lab-field"
											placeholder="Type a command or search..."
										/>
										<hdl-command-list data-testid="command-dialog-list">
											<hdl-command-empty>No results found.</hdl-command-empty>
											<hdl-command-group label="Navigation">
												<p class="lab-command-label">Navigation</p>
												<hdl-command-item value="dashboard">Dashboard</hdl-command-item>
												<hdl-command-item value="collections">Collections</hdl-command-item>
												<hdl-command-item value="media">Media Library</hdl-command-item>
											</hdl-command-group>
											<hdl-command-separator />
											<hdl-command-group label="Actions">
												<p class="lab-command-label">Actions</p>
												<hdl-command-item value="create-post">Create new post</hdl-command-item>
												<hdl-command-item value="upload">Upload file</hdl-command-item>
												<hdl-command-item value="settings">Settings</hdl-command-item>
											</hdl-command-group>
										</hdl-command-list>
									</hdl-command>
								</hdl-command-dialog>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="command-dialog-state"
								>
									Dialog open: {{ commandDialogOpen() }} · Last selection:
									{{ commandDialogSelection() || 'none' }}
								</p>
							</div>
						</div>

						<div class="space-y-3">
							<p
								data-headless-section-label
								class="text-xs font-semibold uppercase tracking-[0.2em]"
							>
								Separator, Progress, Spinner, and Skeleton
							</p>
							<div class="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
								<div class="space-y-3">
									<div class="flex items-center gap-3">
										<span>Uploading assets</span>
										<hdl-separator [decorative]="false" data-testid="separator-demo" />
										<span>{{ progressValue }}%</span>
									</div>
									<hdl-progress [value]="progressValue" data-testid="progress-demo" />
									<div class="flex items-center gap-3">
										<hdl-spinner [active]="spinnerActive" data-testid="spinner-demo" />
										<button
											type="button"
											class="lab-trigger"
											data-testid="progress-advance"
											(click)="advanceProgress()"
										>
											Advance progress
										</button>
									</div>
									<p
										class="text-sm leading-6"
										style="color: var(--hdl-lab-text-muted);"
										data-testid="progress-state"
									>
										Progress: {{ progressValue }}%. Spinner:
										{{ spinnerActive ? 'active' : 'inactive' }}
									</p>
								</div>
								<hdl-separator
									orientation="vertical"
									[decorative]="false"
									data-testid="separator-vertical"
								/>
								<div class="space-y-3">
									<button
										type="button"
										class="lab-trigger"
										data-testid="skeleton-toggle"
										(click)="toggleSkeletonLoaded()"
									>
										{{ skeletonLoaded ? 'Show skeleton' : 'Show loaded card' }}
									</button>
									@if (!skeletonLoaded) {
										<hdl-skeleton data-testid="skeleton-demo">Loading card</hdl-skeleton>
									} @else {
										<div class="rounded-2xl border px-4 py-3" data-testid="skeleton-loaded-card">
											Loaded article card
										</div>
									}
								</div>
							</div>
						</div>
					</div>
				</article>

				<article
					data-headless-card
					class="rounded-[2rem] border p-6"
					data-testid="overlay-primitives-card"
				>
					<div class="space-y-6">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold">Overlay and Context Primitives</h2>
							<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
								Context menus, hover cards, alert dialogs, and drawers should all be globally
								themeable without becoming invisible implementation details.
							</p>
						</div>

						<div class="grid gap-6">
							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Context Menu + Hover Card
								</p>
								<div class="flex flex-wrap gap-3">
									<div
										[hdlContextMenuTrigger]="contextMenuTemplate"
										data-testid="context-menu-target"
										tabindex="0"
										class="lab-trigger"
									>
										Right click canvas
									</div>
									<button
										type="button"
										[hdlHoverCardTrigger]="hoverCardTemplate"
										data-testid="hover-card-trigger"
										class="lab-trigger"
									>
										Hover author card
									</button>
								</div>
								<ng-template #contextMenuTemplate>
									<hdl-context-menu-content data-testid="context-menu-content">
										<div class="grid gap-2">
											<button
												type="button"
												class="lab-trigger"
												data-testid="context-action-copy"
												(click)="contextMenuAction = 'copy'"
											>
												Copy block
											</button>
											<button
												type="button"
												class="lab-trigger"
												data-testid="context-action-archive"
												(click)="contextMenuAction = 'archive'"
											>
												Archive block
											</button>
										</div>
									</hdl-context-menu-content>
								</ng-template>
								<ng-template #hoverCardTemplate>
									<hdl-hover-card-content data-testid="hover-card-content">
										<div class="space-y-1">
											<p class="text-sm font-semibold">Dom Murillo</p>
											<p class="text-sm" style="color: var(--hdl-lab-text-muted);">
												Editing the Managua headless theme contract.
											</p>
										</div>
									</hdl-hover-card-content>
								</ng-template>
								<p
									class="text-sm leading-6"
									style="color: var(--hdl-lab-text-muted);"
									data-testid="context-menu-state"
								>
									Context menu action: {{ contextMenuAction }}
								</p>
							</div>

							<div class="space-y-3">
								<p
									data-headless-section-label
									class="text-xs font-semibold uppercase tracking-[0.2em]"
								>
									Alert Dialog + Drawer
								</p>
								<div class="flex flex-wrap gap-3">
									<button
										type="button"
										data-testid="alert-dialog-trigger"
										(click)="openAlertDialog()"
										class="lab-trigger"
									>
										Open alert dialog
									</button>
									<button
										type="button"
										data-testid="drawer-trigger"
										(click)="openDrawer()"
										class="lab-trigger"
									>
										Open drawer
									</button>
								</div>
								<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
									The alert dialog reuses the shared overlay service with a distinct host contract,
									and the drawer uses side-aware panel classes instead of faking a centered modal.
								</p>
							</div>
						</div>
					</div>
				</article>
			</section>

			<section
				id="toast-primitives"
				data-headless-card
				class="rounded-[2rem] border p-6"
				data-testid="toast-status-card"
			>
				<div class="space-y-3">
					<h2 class="text-2xl font-bold">Toast Action State</h2>
					<p class="text-sm leading-6" style="color: var(--hdl-lab-text-muted);">
						The toast demo renders title, description, action, and dismiss controls through the
						headless toast slots. Trigger a toast above and click
						<span class="font-semibold">Undo</span> to update this readout.
					</p>
					<p
						class="text-sm leading-6"
						style="color: var(--hdl-lab-text-muted);"
						data-testid="toast-last-action"
					>
						Last toast action: {{ lastToastAction }}
					</p>
				</div>
			</section>

			<hdl-toast-container [toastContent]="toastTpl" />
			<ng-template #toastTpl let-toast let-dismissFn="dismiss">
				<div data-slot="toast-body">
					<div data-slot="toast-copy">
						<p data-slot="toast-title">{{ toast.title }}</p>
						@if (toast.description) {
							<p data-slot="toast-description">{{ toast.description }}</p>
						}
					</div>
					@if (toast.action || toast.dismissible) {
						<div data-slot="toast-actions">
							@if (toast.action; as action) {
								<button type="button" data-slot="toast-action" (click)="action.onClick()">
									{{ action.label }}
								</button>
							}
							@if (toast.dismissible) {
								<button
									type="button"
									data-slot="toast-dismiss"
									aria-label="Dismiss notification"
									(click)="dismissFn(toast.id)"
								>
									Dismiss
								</button>
							}
						</div>
					}
				</div>
			</ng-template>
		</main>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeadlessStylingLabPage {
	private readonly document = inject(DOCUMENT);
	private readonly dialogService = inject(HdlDialogService);
	private readonly drawerService = inject(HdlDrawerService);
	private readonly toastService = inject(HdlToastService);
	readonly primitiveCoverage: PrimitiveCoverage[] = [
		{
			slug: 'field',
			label: 'Field',
			intent: 'Connect labels, descriptions, and errors to a shared control.',
			anchor: 'form-foundations',
			sectionLabel: 'Form Foundations',
		},
		{
			slug: 'input',
			label: 'Input',
			intent: 'Edit a required text value and surface invalid state live.',
			anchor: 'form-foundations',
			sectionLabel: 'Form Foundations',
		},
		{
			slug: 'textarea',
			label: 'Textarea',
			intent: 'Capture longer notes while preserving shared field semantics.',
			anchor: 'form-foundations',
			sectionLabel: 'Form Foundations',
		},
		{
			slug: 'chips',
			label: 'Chips',
			intent: 'Add, remove, and backspace tag values from one headless group.',
			anchor: 'form-foundations',
			sectionLabel: 'Form Foundations',
		},
		{
			slug: 'collapsible',
			label: 'Collapsible',
			intent: 'Toggle a hidden region with an explicit open and closed contract.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'toggle',
			label: 'Toggle',
			intent: 'Flip a single pressed state from one host.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'toggle-group',
			label: 'Toggle Group',
			intent: 'Manage a formatting cluster with multi-select behavior.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'select',
			label: 'Select',
			intent: 'Choose a single workflow value from a headless trigger and popup.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'command',
			label: 'Command',
			intent: 'Filter a command list live and select a result.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'separator',
			label: 'Separator',
			intent: 'Expose structural separators without bundling visual rules.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'progress',
			label: 'Progress',
			intent: 'Expose determinate loading state and value semantics.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'spinner',
			label: 'Spinner',
			intent: 'Surface status semantics for active loading affordances.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'skeleton',
			label: 'Skeleton',
			intent: 'Placeholder loading blocks still need a stable host contract.',
			anchor: 'extended-primitives',
			sectionLabel: 'Utility and Command Primitives',
		},
		{
			slug: 'switch',
			label: 'Switch',
			intent: 'Toggle state across global, scoped, and ad hoc recipes.',
			anchor: 'global-layer',
			sectionLabel: 'Global Layer',
		},
		{
			slug: 'tabs',
			label: 'Tabs',
			intent: 'Switch visible panels while hidden panels stay hidden.',
			anchor: 'global-layer',
			sectionLabel: 'Global Layer',
		},
		{
			slug: 'dialog',
			label: 'Dialog',
			intent: 'Open and close a globally styled overlay with backdrop.',
			anchor: 'global-layer',
			sectionLabel: 'Global Layer',
		},
		{
			slug: 'popover',
			label: 'Popover',
			intent: 'Open anchored content and close it cleanly.',
			anchor: 'global-layer',
			sectionLabel: 'Global Layer',
		},
		{
			slug: 'tooltip',
			label: 'Tooltip',
			intent: 'Reveal contextual content on hover or focus.',
			anchor: 'global-layer',
			sectionLabel: 'Global Layer',
		},
		{
			slug: 'toast',
			label: 'Toast',
			intent: 'Render title, description, action, and dismiss controls.',
			anchor: 'toast-primitives',
			sectionLabel: 'Toast Action State',
		},
		{
			slug: 'accordion',
			label: 'Accordion',
			intent: 'Expand and collapse panels without breaking hidden regions.',
			anchor: 'selection-primitives',
			sectionLabel: 'Selection Primitives',
		},
		{
			slug: 'checkbox',
			label: 'Checkbox',
			intent: 'Show checked and indeterminate states with visible readouts.',
			anchor: 'selection-primitives',
			sectionLabel: 'Selection Primitives',
		},
		{
			slug: 'radio-group',
			label: 'Radio Group',
			intent: 'Keep a single active density option.',
			anchor: 'selection-primitives',
			sectionLabel: 'Selection Primitives',
		},
		{
			slug: 'listbox',
			label: 'Listbox',
			intent: 'Switch the selected value and surface it immediately.',
			anchor: 'selection-primitives',
			sectionLabel: 'Selection Primitives',
		},
		{
			slug: 'combobox',
			label: 'Combobox',
			intent: 'Show all results first, then filter and select one.',
			anchor: 'selection-primitives',
			sectionLabel: 'Selection Primitives',
		},
		{
			slug: 'tree',
			label: 'Tree',
			intent: 'Expand hierarchy and select a node.',
			anchor: 'navigation-primitives',
			sectionLabel: 'Navigation and Data Primitives',
		},
		{
			slug: 'grid',
			label: 'Grid',
			intent: 'Select a cell and surface that selection state.',
			anchor: 'navigation-primitives',
			sectionLabel: 'Navigation and Data Primitives',
		},
		{
			slug: 'menu',
			label: 'Menu',
			intent: 'Open a popup menu, invoke an action, and respect disabled items.',
			anchor: 'navigation-primitives',
			sectionLabel: 'Navigation and Data Primitives',
		},
		{
			slug: 'menu-bar',
			label: 'Menu Bar',
			intent: 'Update the current section when a menu bar item is activated.',
			anchor: 'navigation-primitives',
			sectionLabel: 'Navigation and Data Primitives',
		},
		{
			slug: 'toolbar',
			label: 'Toolbar',
			intent: 'Toggle formatting values from the toolbar group.',
			anchor: 'navigation-primitives',
			sectionLabel: 'Navigation and Data Primitives',
		},
		{
			slug: 'context-menu',
			label: 'Context Menu',
			intent: 'Open a menu from pointer context instead of a plain click trigger.',
			anchor: 'extended-primitives',
			sectionLabel: 'Overlay and Context Primitives',
		},
		{
			slug: 'hover-card',
			label: 'Hover Card',
			intent: 'Reveal contextual card content after hover intent.',
			anchor: 'extended-primitives',
			sectionLabel: 'Overlay and Context Primitives',
		},
		{
			slug: 'alert-dialog',
			label: 'Alert Dialog',
			intent: 'Render destructive confirmation content with an alertdialog host.',
			anchor: 'extended-primitives',
			sectionLabel: 'Overlay and Context Primitives',
		},
		{
			slug: 'drawer',
			label: 'Drawer',
			intent: 'Slide in a side-aware overlay with a dedicated drawer contract.',
			anchor: 'extended-primitives',
			sectionLabel: 'Overlay and Context Primitives',
		},
	];
	readonly themeMode = signal<'light' | 'dark'>(
		this.document.documentElement.classList.contains('dark') ? 'dark' : 'light',
	);
	readonly comboboxOptions: PrimitiveOption[] = [
		{ label: 'Switch', value: 'switch' },
		{ label: 'Tabs', value: 'tabs' },
		{ label: 'Dialog', value: 'dialog' },
		{ label: 'Popover', value: 'popover' },
		{ label: 'Tooltip', value: 'tooltip' },
		{ label: 'Toast', value: 'toast' },
		{ label: 'Accordion', value: 'accordion' },
		{ label: 'Checkbox', value: 'checkbox' },
		{ label: 'Radio Group', value: 'radio-group' },
		{ label: 'Listbox', value: 'listbox' },
		{ label: 'Combobox', value: 'combobox' },
		{ label: 'Tree', value: 'tree' },
		{ label: 'Grid', value: 'grid' },
		{ label: 'Menu', value: 'menu' },
		{ label: 'Menu Bar', value: 'menu-bar' },
		{ label: 'Toolbar', value: 'toolbar' },
		{ label: 'Field', value: 'field' },
		{ label: 'Input', value: 'input' },
		{ label: 'Textarea', value: 'textarea' },
		{ label: 'Chips', value: 'chips' },
		{ label: 'Collapsible', value: 'collapsible' },
		{ label: 'Toggle', value: 'toggle' },
		{ label: 'Toggle Group', value: 'toggle-group' },
		{ label: 'Select', value: 'select' },
		{ label: 'Command', value: 'command' },
		{ label: 'Separator', value: 'separator' },
		{ label: 'Progress', value: 'progress' },
		{ label: 'Spinner', value: 'spinner' },
		{ label: 'Skeleton', value: 'skeleton' },
		{ label: 'Context Menu', value: 'context-menu' },
		{ label: 'Hover Card', value: 'hover-card' },
		{ label: 'Alert Dialog', value: 'alert-dialog' },
		{ label: 'Drawer', value: 'drawer' },
	];
	readonly comboboxQuery = signal('');
	readonly comboboxSelection = signal('none');
	readonly filteredComboboxOptions = computed(() => {
		const query = this.comboboxQuery().trim().toLowerCase();
		if (!query) {
			return this.comboboxOptions;
		}

		return this.comboboxOptions.filter((option) => option.label.toLowerCase().includes(query));
	});

	selectedGlobalTab = 'overview';
	selectedScopedTab = 'berry-a';
	globalSwitchEnabled = false;
	scopedSwitchEnabled = false;
	adhocSwitchEnabled = false;
	displayName = '';
	editorialNotes = 'Review hero copy after the accessibility pass.';
	chipValues = ['angular', 'headless', 'cms'];
	accordionInstallExpanded = true;
	accordionContractExpanded = false;
	checkboxPublishReady = false;
	checkboxFeatured = true;
	radioDensity = 'comfortable';
	listboxValues = ['tokens'];
	collapsibleOpen = false;
	soloToggleOn = false;
	toggleGroupValues = ['bold'];
	selectValue: string | null = 'review';
	commandSelection: string | null = null;
	readonly commandDialogOpen = signal(false);
	readonly commandDialogSelection = signal<string | null>(null);
	progressValue = 36;
	spinnerActive = true;
	skeletonLoaded = false;
	contextMenuAction = 'none';
	treeValues = ['settings'];
	treeContentExpanded = true;
	gridSelection = 'none';
	toolbarValues = ['bold'];
	menuBarSelection = 'content';
	lastMenuAction = 'none';
	lastToastAction = 'none';

	toggleTheme(): void {
		const nextTheme = this.themeMode() === 'light' ? 'dark' : 'light';
		this.themeMode.set(nextTheme);
		this.document.documentElement.classList.toggle('dark', nextTheme === 'dark');
	}

	openDialog(): void {
		this.dialogService.open(HeadlessStylingLabDialogComponent, {
			width: 'min(32rem, calc(100vw - 2rem))',
		});
	}

	showToast(): void {
		this.lastToastAction = 'none';
		this.toastService.show('Theme saved', 'Global recipes and overrides are active.', {
			variant: 'success',
			action: {
				label: 'Undo',
				onClick: () => {
					this.lastToastAction = 'undo';
				},
			},
		});
	}

	recordMenuAction(action: string): void {
		this.lastMenuAction = action;
	}

	advanceProgress(): void {
		this.progressValue = Math.min(this.progressValue + 24, 100);
		this.spinnerActive = this.progressValue < 100;
	}

	toggleSkeletonLoaded(): void {
		this.skeletonLoaded = !this.skeletonLoaded;
	}

	updateComboboxQuery(event: Event): void {
		if (event.target instanceof HTMLInputElement) {
			this.comboboxQuery.set(event.target.value);
			return;
		}

		this.comboboxQuery.set('');
	}

	selectComboboxOption(option: PrimitiveOption): void {
		this.comboboxSelection.set(option.value);
		this.comboboxQuery.set(option.label);
	}

	updateDisplayName(event: Event): void {
		this.displayName = event.target instanceof HTMLInputElement ? event.target.value : '';
	}

	updateEditorialNotes(event: Event): void {
		this.editorialNotes =
			event.target instanceof HTMLTextAreaElement ? event.target.value : this.editorialNotes;
	}

	openAlertDialog(): void {
		this.dialogService.open(HeadlessStylingLabAlertDialogComponent, {
			width: 'min(30rem, calc(100vw - 2rem))',
		});
	}

	openDrawer(): void {
		this.drawerService.open(HeadlessStylingLabDrawerComponent, {
			side: 'right',
			width: 'min(92vw, 28rem)',
		});
	}
}
