/**
 * Theme Editor Page
 *
 * Visual theme editor for @momentumcms/headless components.
 * Two-panel layout: controls on left, preview + code output on right.
 */

import { Component, ChangeDetectionStrategy, inject, signal } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { ThemeEditorStore } from './theme-editor.store';
import { PresetSelectorComponent } from './controls/preset-selector.component';
import { ColorSectionComponent } from './controls/color-section.component';
import { TypographyControlsComponent } from './controls/typography-controls.component';
import { VisualControlsComponent } from './controls/visual-controls.component';
import { ThemePreviewComponent } from './preview/theme-preview.component';
import { CodePanelComponent } from './output/code-panel.component';
import { HdlTabs, HdlTabList, HdlTab } from '@momentumcms/headless';
import type { ThemeStyleProps } from './theme-editor.types';

@Component({
	selector: 'hdl-theme-editor',
	imports: [
		NgTemplateOutlet,
		PresetSelectorComponent,
		ColorSectionComponent,
		TypographyControlsComponent,
		VisualControlsComponent,
		ThemePreviewComponent,
		CodePanelComponent,
		HdlTabs,
		HdlTabList,
		HdlTab,
	],
	providers: [ThemeEditorStore],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block p-4 lg:p-6' },
	styles: `
		:host {
			height: 100dvh;
			overflow: clip;
			display: flex;
			flex-direction: column;
		}
		/* Headless tab component styling for mobile tab switcher */
		hdl-tabs {
			display: flex;
			flex-direction: column;
			min-height: 0;
			flex: 1;
		}
		hdl-tab-list {
			display: flex;
			flex-shrink: 0;
		}
		hdl-tab {
			display: block;
			flex: 1;
			padding: 0.5rem 0;
			text-align: center;
			font-size: 0.875rem;
			line-height: 1.25rem;
			font-weight: 500;
			cursor: pointer;
			transition: color 150ms;
		}
		hdl-tab:focus-visible {
			outline: 2px solid;
			outline-offset: 2px;
		}
		hdl-tab[data-state='selected'] {
			border-bottom: 2px solid;
		}
		.mobile-panel {
			overflow-y: auto;
			flex: 1;
		}
	`,
	template: `
		<!-- Skip Link -->
		<a
			href="#theme-preview"
			class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:p-2 focus:bg-background focus:text-foreground focus:border focus:border-border focus:rounded"
		>
			Skip to preview
		</a>

		<!-- Top Bar -->
		<header class="flex items-center justify-between mb-4 flex-wrap gap-2 shrink-0">
			<h1 class="text-2xl font-bold tracking-tight text-foreground">Theme Editor</h1>
			<div class="flex items-center gap-2">
				<!-- Mode Toggle -->
				<div
					class="flex rounded-md border border-border overflow-hidden text-xs"
					role="group"
					aria-label="Color mode"
				>
					<button
						type="button"
						class="px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						[attr.aria-pressed]="store.currentMode() === 'light'"
						[class]="
							store.currentMode() === 'light'
								? 'bg-primary text-primary-foreground'
								: 'hover:bg-accent text-muted-foreground'
						"
						(click)="store.setMode('light')"
					>
						Light
					</button>
					<button
						type="button"
						class="px-3 py-1.5 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
						[attr.aria-pressed]="store.currentMode() === 'dark'"
						[class]="
							store.currentMode() === 'dark'
								? 'bg-primary text-primary-foreground'
								: 'hover:bg-accent text-muted-foreground'
						"
						(click)="store.setMode('dark')"
					>
						Dark
					</button>
				</div>

				<!-- Undo/Redo -->
				<button
					type="button"
					class="text-xs px-2 py-1.5 rounded border border-border text-foreground hover:bg-accent disabled:opacity-40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					[disabled]="!store.canUndo()"
					aria-label="Undo"
					(click)="store.undo()"
				>
					Undo
				</button>
				<button
					type="button"
					class="text-xs px-2 py-1.5 rounded border border-border text-foreground hover:bg-accent disabled:opacity-40 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					[disabled]="!store.canRedo()"
					aria-label="Redo"
					(click)="store.redo()"
				>
					Redo
				</button>
				<button
					type="button"
					class="text-xs px-2 py-1.5 rounded border border-border text-muted-foreground hover:bg-accent transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
					aria-label="Reset all theme settings to preset defaults"
					(click)="store.reset()"
				>
					Reset
				</button>
			</div>
		</header>

		<!-- Two-Panel Layout -->
		<div class="flex gap-4 flex-1 min-h-0" data-testid="theme-controls-layout">
			<!-- Controls Panel (left, desktop) -->
			<aside
				class="w-80 shrink-0 overflow-y-auto space-y-6 pr-2 hidden lg:block"
				data-testid="theme-controls"
				aria-label="Theme controls"
			>
				<ng-container *ngTemplateOutlet="controlsTpl" />
			</aside>

			<!-- Mobile Tab Switcher (uses @angular/aria via headless tabs) -->
			<div class="lg:hidden w-full flex flex-col min-h-0">
				<hdl-tabs>
					<hdl-tab-list
						class="border-b border-border mb-4"
						[selectedTab]="activeTab()"
						(selectedTabChange)="onTabChange($event)"
					>
						<hdl-tab
							value="controls"
							class="text-foreground [&[data-state=unselected]]:text-muted-foreground"
							>Controls</hdl-tab
						>
						<hdl-tab
							value="preview"
							class="text-foreground [&[data-state=unselected]]:text-muted-foreground"
							>Preview</hdl-tab
						>
						<hdl-tab
							value="code"
							class="text-foreground [&[data-state=unselected]]:text-muted-foreground"
							>Code</hdl-tab
						>
					</hdl-tab-list>
				</hdl-tabs>
				@switch (activeTab()) {
					@case ('controls') {
						<div class="mobile-panel space-y-6">
							<ng-container *ngTemplateOutlet="controlsTpl" />
						</div>
					}
					@case ('preview') {
						<div class="mobile-panel">
							<hdl-theme-preview [config]="store.state().styles" [mode]="store.currentMode()" />
						</div>
					}
					@case ('code') {
						<div class="mobile-panel">
							<hdl-theme-code-panel [config]="store.state().styles" />
						</div>
					}
				}
			</div>

			<!-- Preview + Code (right, desktop only) -->
			<main
				id="theme-preview"
				class="flex-1 overflow-y-auto space-y-6 hidden lg:block"
				aria-label="Theme preview and output"
			>
				<hdl-theme-preview [config]="store.state().styles" [mode]="store.currentMode()" />
				<hdl-theme-code-panel [config]="store.state().styles" />
			</main>
		</div>

		<!-- Shared controls template -->
		<ng-template #controlsTpl>
			<hdl-theme-preset-selector
				[presets]="store.presets"
				[selectedId]="store.presetId()"
				(presetSelect)="store.applyPreset($event)"
			/>
			<hdl-theme-color-section
				[styles]="store.currentStyles()"
				(colorChange)="onStyleChange($event.key, $event.value)"
			/>
			<hdl-theme-typography-controls
				[styles]="store.currentStyles()"
				(styleChange)="onStyleChange($event.key, $event.value)"
			/>
			<hdl-theme-visual-controls
				[styles]="store.currentStyles()"
				(styleChange)="onStyleChange($event.key, $event.value)"
			/>
		</ng-template>
	`,
})
export class ThemeEditorPage {
	protected readonly store = inject(ThemeEditorStore);
	protected readonly activeTab = signal('controls');

	onTabChange(tab: string | undefined): void {
		if (tab) this.activeTab.set(tab);
	}

	onStyleChange(key: keyof ThemeStyleProps, value: string): void {
		this.store.setStyleProp(key, value);
	}
}
