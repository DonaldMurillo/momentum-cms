import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
	HdlDialog,
	HdlDialogClose,
	HdlDialogDescription,
	HdlDialogService,
	HdlDialogTitle,
	HdlPopoverContent,
	HdlPopoverTrigger,
	HdlSwitch,
	HdlTab,
	HdlTabList,
	HdlTabPanel,
	HdlTabs,
	HdlToastContainer,
	HdlToastService,
	HdlTooltipTrigger,
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
				<p class="text-sm text-slate-700">
					The backdrop, panel, title, and close button all use the stable headless selectors.
				</p>
				<div class="flex justify-end">
					<button
						hdlDialogClose
						type="button"
						data-testid="dialog-close"
						class="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white"
					>
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
		HdlSwitch,
		HdlTabs,
		HdlTabList,
		HdlTab,
		HdlTabPanel,
		HdlPopoverTrigger,
		HdlPopoverContent,
		HdlTooltipTrigger,
		HdlToastContainer,
	],
	template: `
		<main
			data-headless-demo
			class="mx-auto flex min-h-screen max-w-6xl flex-col gap-10 px-6 py-12 lg:px-10"
		>
			<header class="space-y-4">
				<p
					class="inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-orange-700"
				>
					Headless Styling Lab
				</p>
				<div class="max-w-3xl space-y-3">
					<h1 class="text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">
						Global recipes, scoped theme overrides, and ad hoc tweaks
					</h1>
					<p class="text-lg leading-8 text-slate-700">
						This page exists to prove the headless primitives can be themed from one global layer
						without giving up one-off customization.
					</p>
				</div>
			</header>

			<section class="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
				<article class="rounded-[2rem] border border-orange-200 bg-white/90 p-6 shadow-sm">
					<div class="space-y-4">
						<div class="space-y-2">
							<h2 class="text-2xl font-bold text-slate-950">Global Layer</h2>
							<p class="text-sm leading-6 text-slate-600">
								These primitives only receive classes on layout wrappers. The switch, tabs, dialog,
								popover, tooltip, and toast styling all come from the global selectors.
							</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-3">
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
									Switch
								</p>
								<hdl-switch data-testid="global-switch" aria-label="Global switch">
									<span class="headless-thumb"></span>
								</hdl-switch>
							</div>

							<div class="space-y-3">
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
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
										Focus tooltip
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
											<p class="text-sm font-semibold text-slate-950">Popover styling</p>
											<p class="text-sm text-slate-600">
												The panel and content are styled from the global layer.
											</p>
										</div>
									</hdl-popover-content>
								</ng-template>
							</div>
						</div>

						<div class="space-y-4">
							<p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Tabs</p>
							<hdl-tabs data-testid="global-tabs">
								<hdl-tab-list [(selectedTab)]="selectedGlobalTab">
									<hdl-tab value="overview" data-testid="global-tab-overview">Overview</hdl-tab>
									<hdl-tab value="tokens" data-testid="global-tab-tokens">Tokens</hdl-tab>
								</hdl-tab-list>
								<hdl-tab-panel value="overview">
									<p class="text-sm leading-6 text-slate-700">
										Global recipes target the headless slots instead of private markup.
									</p>
								</hdl-tab-panel>
								<hdl-tab-panel value="tokens">
									<p class="text-sm leading-6 text-slate-700">
										State selectors like <code>data-state</code> keep the recipes explicit.
									</p>
								</hdl-tab-panel>
							</hdl-tabs>
						</div>
					</div>
				</article>

				<div class="grid gap-6">
					<article
						data-headless-theme="berry"
						class="rounded-[2rem] border border-pink-200 bg-white/90 p-6 shadow-sm"
					>
						<div class="space-y-4">
							<div class="space-y-2">
								<h2 class="text-2xl font-bold text-slate-950">Scoped Override</h2>
								<p class="text-sm leading-6 text-slate-600">
									This wrapper swaps the accent tokens without changing the primitive markup.
								</p>
							</div>

							<div class="space-y-3">
								<p class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
									Scoped switch
								</p>
								<hdl-switch data-testid="scoped-switch" aria-label="Scoped switch">
									<span class="headless-thumb"></span>
								</hdl-switch>
							</div>

							<hdl-tabs>
								<hdl-tab-list [(selectedTab)]="selectedScopedTab">
									<hdl-tab value="berry-a" data-testid="scoped-tab-berry">Berry</hdl-tab>
									<hdl-tab value="berry-b" data-testid="scoped-tab-contrast">Contrast</hdl-tab>
								</hdl-tab-list>
								<hdl-tab-panel value="berry-a">
									<p class="text-sm leading-6 text-slate-700">
										The selected tab inherits the scoped berry accent.
									</p>
								</hdl-tab-panel>
								<hdl-tab-panel value="berry-b">
									<p class="text-sm leading-6 text-slate-700">
										Same primitive, different token scope, no component rewrite.
									</p>
								</hdl-tab-panel>
							</hdl-tabs>
						</div>
					</article>

					<article class="rounded-[2rem] border border-teal-200 bg-white/90 p-6 shadow-sm">
						<div class="space-y-4">
							<div class="space-y-2">
								<h2 class="text-2xl font-bold text-slate-950">Ad Hoc Override</h2>
								<p class="text-sm leading-6 text-slate-600">
									One host gets a custom class and diverges from the default recipe on purpose.
								</p>
							</div>
							<hdl-switch
								class="lab-switch--adhoc"
								data-testid="adhoc-switch"
								aria-label="Ad hoc switch"
							>
								<span class="headless-thumb"></span>
							</hdl-switch>
						</div>
					</article>
				</div>
			</section>

			<hdl-toast-container />
		</main>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeadlessStylingLabPage {
	private readonly dialogService = inject(HdlDialogService);
	private readonly toastService = inject(HdlToastService);

	selectedGlobalTab = 'overview';
	selectedScopedTab = 'berry-a';

	openDialog(): void {
		this.dialogService.open(HeadlessStylingLabDialogComponent, {
			width: 'min(32rem, calc(100vw - 2rem))',
		});
	}

	showToast(): void {
		this.toastService.success('Theme saved', 'Global recipes and overrides are active.');
	}
}
