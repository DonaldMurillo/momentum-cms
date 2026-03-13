/**
 * Components Showcase
 *
 * Renders live headless primitives for the theme preview.
 * Uses actual @momentumcms/headless components where possible,
 * with static mockups for overlay-based components (dialog, toast, popover, tooltip, etc).
 */

import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
	HdlAccordion,
	HdlAccordionItem,
	HdlAccordionTrigger,
	HdlAccordionContent,
	HdlTabs,
	HdlTabList,
	HdlTab,
	HdlTabPanel,
	HdlCheckbox,
	HdlSwitch,
	HdlInput,
	HdlTextarea,
	HdlSeparator,
	HdlProgress,
	HdlSpinner,
	HdlRadioGroup,
	HdlRadioItem,
	HdlToggle,
	HdlToggleGroup,
	HdlToggleItem,
	HdlSkeleton,
} from '@momentumcms/headless';

@Component({
	selector: 'hdl-theme-components-showcase',
	imports: [
		HdlAccordion,
		HdlAccordionItem,
		HdlAccordionTrigger,
		HdlAccordionContent,
		HdlTabs,
		HdlTabList,
		HdlTab,
		HdlTabPanel,
		HdlCheckbox,
		HdlSwitch,
		HdlInput,
		HdlTextarea,
		HdlSeparator,
		HdlProgress,
		HdlSpinner,
		HdlRadioGroup,
		HdlRadioItem,
		HdlToggle,
		HdlToggleGroup,
		HdlToggleItem,
		HdlSkeleton,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'block' },
	styles: `
		:host h2 {
			color: var(--foreground);
			font-family: var(--font-sans);
			font-size: 0.875rem;
			font-weight: 500;
			margin-bottom: 0.75rem;
		}
		:host section {
			margin-bottom: 2rem;
		}
		:host section:last-child {
			margin-bottom: 0;
		}
	`,
	template: `
		<!-- Buttons -->
		<section aria-label="Buttons">
			<h2>Buttons</h2>
			<div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
				<button data-slot="button">Primary</button>
				<button data-slot="button" data-variant="secondary">Secondary</button>
				<button data-slot="button" data-variant="outline">Outline</button>
				<button data-slot="button" data-variant="destructive">Destructive</button>
				<button data-slot="button" data-variant="ghost">Ghost</button>
				<button data-slot="button" data-variant="link">Link</button>
				<button data-slot="button" disabled>Disabled</button>
			</div>
		</section>

		<!-- Form Controls -->
		<section aria-label="Form Controls">
			<h2>Form Controls</h2>
			<div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 24rem;">
				<div data-slot="field">
					<span data-slot="label" id="showcase-email-label">Email address</span>
					<p data-slot="description" id="showcase-email-desc">We'll never share your email.</p>
					<input hdl-input placeholder="you@example.com" aria-labelledby="showcase-email-label" aria-describedby="showcase-email-desc" />
				</div>
				<div data-slot="field">
					<span data-slot="label" id="showcase-message-label">Message</span>
					<textarea hdl-textarea placeholder="Type your message..." aria-labelledby="showcase-message-label"></textarea>
				</div>
				<div data-slot="field">
					<span data-slot="label" id="showcase-validation-label">Validation example</span>
					<input hdl-input value="invalid-email" aria-invalid="true" aria-labelledby="showcase-validation-label" aria-describedby="showcase-validation-error" />
					<span data-slot="error" id="showcase-validation-error">Please enter a valid email address.</span>
				</div>
			</div>
		</section>

		<!-- Checkbox, Switch & Radio -->
		<section aria-label="Selection Controls">
			<h2>Selection Controls</h2>
			<div style="display: flex; align-items: flex-start; gap: 2rem; flex-wrap: wrap;">
				<div style="display: flex; flex-direction: column; gap: 0.5rem;">
					<div style="display: flex; align-items: center; gap: 0.5rem;">
						<hdl-checkbox aria-label="Accept terms" />
						<span data-slot="label">Accept terms</span>
					</div>
					<div style="display: flex; align-items: center; gap: 0.5rem;">
						<hdl-switch aria-label="Notifications" />
						<span data-slot="label">Notifications</span>
					</div>
				</div>
				<div>
					<span data-slot="label" style="display: block; margin-bottom: 0.5rem;">Plan</span>
					<hdl-radio-group aria-label="Plan selection">
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<hdl-radio-item value="free" aria-label="Free" />
							<span data-slot="label">Free</span>
						</div>
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<hdl-radio-item value="pro" aria-label="Pro" />
							<span data-slot="label">Pro</span>
						</div>
						<div style="display: flex; align-items: center; gap: 0.5rem;">
							<hdl-radio-item value="enterprise" aria-label="Enterprise" />
							<span data-slot="label">Enterprise</span>
						</div>
					</hdl-radio-group>
				</div>
			</div>
		</section>

		<!-- Toggle -->
		<section aria-label="Toggle">
			<h2>Toggle</h2>
			<div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
				<hdl-toggle aria-label="Bold">B</hdl-toggle>
				<hdl-toggle-group aria-label="Text formatting">
					<hdl-toggle-item value="bold" aria-label="Bold">B</hdl-toggle-item>
					<hdl-toggle-item value="italic" aria-label="Italic">I</hdl-toggle-item>
					<hdl-toggle-item value="underline" aria-label="Underline">U</hdl-toggle-item>
				</hdl-toggle-group>
			</div>
		</section>

		<hdl-separator />

		<!-- Select (static mockup) -->
		<section aria-label="Select static preview">
			<h2>Select (static preview)</h2>
			<div style="max-width: 16rem;" inert>
				<div data-slot="select-trigger" style="width: 100%;">
					<span data-slot="select-value">Choose a framework...</span>
				</div>
				<div data-slot="select-content" style="margin-top: 0.25rem;">
					<div data-slot="select-item">Angular</div>
					<div data-slot="select-item" data-state="selected">React</div>
					<div data-slot="select-item">Vue</div>
					<div data-slot="select-item">Svelte</div>
				</div>
			</div>
		</section>

		<!-- Tabs -->
		<section aria-label="Tabs">
			<h2>Tabs</h2>
			<hdl-tabs>
				<hdl-tab-list>
					<hdl-tab value="account">Account</hdl-tab>
					<hdl-tab value="security">Security</hdl-tab>
					<hdl-tab value="billing">Billing</hdl-tab>
				</hdl-tab-list>
				<hdl-tab-panel value="account">Account settings and preferences.</hdl-tab-panel>
				<hdl-tab-panel value="security">Password, 2FA, and login history.</hdl-tab-panel>
				<hdl-tab-panel value="billing">Subscription and payment methods.</hdl-tab-panel>
			</hdl-tabs>
		</section>

		<!-- Accordion -->
		<section aria-label="Accordion">
			<h2>Accordion</h2>
			<hdl-accordion>
				<hdl-accordion-item>
					<hdl-accordion-trigger panelId="p1">What is Momentum CMS?</hdl-accordion-trigger>
					<hdl-accordion-content panelId="p1">
						An Angular-based headless CMS with type-safe collections, auto-generated admin UI,
						REST API, and database schema.
					</hdl-accordion-content>
				</hdl-accordion-item>
				<hdl-accordion-item>
					<hdl-accordion-trigger panelId="p2">How does theming work?</hdl-accordion-trigger>
					<hdl-accordion-content panelId="p2">
						Headless components use data-slot attributes for styling. This editor generates CSS
						custom properties and component selectors you can use in your app.
					</hdl-accordion-content>
				</hdl-accordion-item>
				<hdl-accordion-item>
					<hdl-accordion-trigger panelId="p3">Can I use my own design system?</hdl-accordion-trigger>
					<hdl-accordion-content panelId="p3">
						Absolutely. The headless primitives provide behavior and accessibility — you bring
						your own styles via data-slot selectors.
					</hdl-accordion-content>
				</hdl-accordion-item>
			</hdl-accordion>
		</section>

		<!-- Progress & Spinner -->
		<section aria-label="Feedback">
			<h2>Feedback</h2>
			<div style="display: flex; flex-direction: column; gap: 0.75rem; max-width: 24rem;">
				<hdl-progress [value]="65" aria-label="Upload progress" style="--progress-value: 65;" />
				<div style="display: flex; align-items: center; gap: 0.5rem;">
					<hdl-spinner />
					<span data-slot="description">Loading...</span>
				</div>
			</div>
		</section>

		<!-- Skeleton -->
		<section aria-label="Skeleton">
			<h2>Skeleton</h2>
			<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 24rem;">
				<hdl-skeleton style="height: 1rem; width: 75%;" />
				<hdl-skeleton style="height: 1rem; width: 50%;" />
				<hdl-skeleton style="height: 2.5rem; width: 100%; border-radius: var(--radius);" />
			</div>
		</section>

		<hdl-separator />

		<!-- Static Dialog Mockup -->
		<section aria-label="Dialog static preview">
			<h2>Dialog (static preview)</h2>
			<div data-slot="dialog" style="max-width: 28rem;" inert>
				<div data-slot="dialog-title">Confirm Action</div>
				<p data-slot="dialog-description" style="margin-top: 0.25rem;">
					Are you sure you want to proceed? This action cannot be undone.
				</p>
				<div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
					<button data-slot="button" data-variant="secondary">Cancel</button>
					<button data-slot="button">Confirm</button>
				</div>
			</div>
		</section>

		<!-- Static Alert Dialog Mockup -->
		<section aria-label="Alert dialog static preview">
			<h2>Alert Dialog (static preview)</h2>
			<div data-slot="alert-dialog" style="max-width: 28rem;" inert>
				<div data-slot="alert-dialog-title">Delete Account</div>
				<p data-slot="alert-dialog-description" style="margin-top: 0.25rem;">
					This will permanently delete your account and all associated data.
				</p>
				<div style="display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1rem;">
					<button data-slot="alert-dialog-cancel">Cancel</button>
					<button data-slot="alert-dialog-action">Delete</button>
				</div>
			</div>
		</section>

		<!-- Static Drawer Mockup -->
		<section aria-label="Drawer static preview">
			<h2>Drawer (static preview)</h2>
			<div data-slot="drawer" style="max-width: 20rem; border-radius: var(--radius);" inert>
				<div data-slot="drawer-title">Settings</div>
				<p data-slot="drawer-description" style="margin-top: 0.25rem;">
					Manage your application preferences.
				</p>
				<div style="margin-top: 1rem;">
					<div data-slot="field">
						<span data-slot="label" id="showcase-drawer-name">Display name</span>
						<input data-slot="input" value="John Doe" aria-labelledby="showcase-drawer-name" />
					</div>
				</div>
			</div>
		</section>

		<!-- Static Toast Mockup -->
		<section aria-label="Toast static preview">
			<h2>Toast (static preview)</h2>
			<div style="display: flex; flex-direction: column; gap: 0.5rem; max-width: 24rem;">
				<div data-slot="toast">
					<span data-slot="toast-title">Success</span>
					<span data-slot="toast-description" style="display: block;">Document saved successfully.</span>
				</div>
				<div data-slot="toast" data-variant="destructive">
					<span data-slot="toast-title">Error</span>
					<span data-slot="toast-description" style="display: block;">Failed to save changes.</span>
				</div>
			</div>
		</section>

		<hdl-separator />

		<!-- Chips -->
		<section aria-label="Chips">
			<h2>Chips</h2>
			<div style="display: flex; flex-wrap: wrap; gap: 0.375rem;">
				<span data-slot="chip">Angular</span>
				<span data-slot="chip">TypeScript</span>
				<span data-slot="chip">Tailwind</span>
				<span data-slot="chip">Drizzle</span>
			</div>
		</section>

		<!-- Static Popover Mockup -->
		<section aria-label="Popover and Tooltip static preview">
			<h2>Popover &amp; Tooltip (static preview)</h2>
			<div style="display: flex; gap: 1.5rem; flex-wrap: wrap;" inert>
				<div>
					<button data-slot="button" data-variant="outline" style="margin-bottom: 0.5rem;">Open Popover</button>
					<div data-slot="popover-content" style="max-width: 16rem;">
						<p style="font-family: var(--font-sans); font-size: 0.875rem; color: var(--foreground);">
							Popover content with rich information.
						</p>
					</div>
				</div>
				<div>
					<button data-slot="button" data-variant="outline" style="margin-bottom: 0.5rem;">Hover me</button>
					<div data-slot="tooltip-content">Tooltip text</div>
				</div>
			</div>
		</section>

		<!-- Static Hover Card Mockup -->
		<section aria-label="Hover Card static preview">
			<h2>Hover Card (static preview)</h2>
			<div inert>
				<div data-slot="hover-card-content" style="max-width: 20rem;">
					<p style="font-family: var(--font-sans); font-size: 0.875rem; font-weight: 600; color: var(--foreground);">@momentum</p>
					<p style="font-family: var(--font-sans); font-size: 0.75rem; color: var(--muted-foreground); margin-top: 0.25rem;">
						Angular-based headless CMS with type-safe collections.
					</p>
				</div>
			</div>
		</section>

		<hdl-separator />

		<!-- Static Menu Mockup -->
		<section aria-label="Menu static preview">
			<h2>Menu (static preview)</h2>
			<div style="display: flex; gap: 1.5rem; flex-wrap: wrap;" inert>
				<div data-slot="menu" style="width: 12rem;">
					<div data-slot="menu-item">New File</div>
					<div data-slot="menu-item">Open...</div>
					<div data-slot="separator"></div>
					<div data-slot="menu-item">Save</div>
					<div data-slot="menu-item" data-disabled>Print</div>
				</div>
			</div>
		</section>

		<!-- Static Context Menu Mockup -->
		<section aria-label="Context Menu static preview">
			<h2>Context Menu (static preview)</h2>
			<div inert>
				<div data-slot="context-menu-content" style="width: 12rem;">
					<div data-slot="menu-item">Cut</div>
					<div data-slot="menu-item">Copy</div>
					<div data-slot="menu-item">Paste</div>
					<div data-slot="separator"></div>
					<div data-slot="menu-item">Delete</div>
				</div>
			</div>
		</section>

		<!-- Static Listbox Mockup -->
		<section aria-label="Listbox static preview">
			<h2>Listbox (static preview)</h2>
			<div inert>
				<div data-slot="listbox" style="max-width: 16rem;">
					<div data-slot="option">Apple</div>
					<div data-slot="option" data-state="selected">Banana</div>
					<div data-slot="option">Cherry</div>
					<div data-slot="option">Date</div>
				</div>
			</div>
		</section>

		<!-- Static Combobox Mockup -->
		<section aria-label="Combobox static preview">
			<h2>Combobox (static preview)</h2>
			<div style="max-width: 16rem;" inert>
				<input data-slot="combobox-input" placeholder="Search fruits..." />
				<div data-slot="combobox-popup" style="margin-top: 0.25rem;">
					<div data-slot="option">Apple</div>
					<div data-slot="option">Avocado</div>
					<div data-slot="option">Apricot</div>
				</div>
			</div>
		</section>

		<hdl-separator />

		<!-- Static Command Mockup -->
		<section aria-label="Command Palette static preview">
			<h2>Command Palette (static preview)</h2>
			<div data-slot="command" style="max-width: 24rem;" inert>
				<input data-slot="command-input" placeholder="Type a command or search..." />
				<div data-slot="command-list">
					<div data-slot="command-group">
						<div data-slot="command-item">New Document</div>
						<div data-slot="command-item" data-state="selected">Open File</div>
						<div data-slot="command-item">Search</div>
					</div>
					<div data-slot="command-separator"></div>
					<div data-slot="command-group">
						<div data-slot="command-item">Settings</div>
						<div data-slot="command-item">Help</div>
					</div>
				</div>
			</div>
		</section>

		<!-- Static Grid Mockup -->
		<section aria-label="Grid static preview">
			<h2>Grid (static preview)</h2>
			<div data-slot="grid" style="grid-template-columns: repeat(3, 1fr);" inert>
				<div data-slot="grid-row" style="display: grid; grid-template-columns: subgrid; grid-column: 1/-1; font-weight: 500; background: var(--muted);">
					<div data-slot="grid-cell">Name</div>
					<div data-slot="grid-cell">Role</div>
					<div data-slot="grid-cell">Status</div>
				</div>
				<div data-slot="grid-row" style="display: grid; grid-template-columns: subgrid; grid-column: 1/-1;">
					<div data-slot="grid-cell">Alice</div>
					<div data-slot="grid-cell">Admin</div>
					<div data-slot="grid-cell">Active</div>
				</div>
				<div data-slot="grid-row" style="display: grid; grid-template-columns: subgrid; grid-column: 1/-1;">
					<div data-slot="grid-cell">Bob</div>
					<div data-slot="grid-cell">Editor</div>
					<div data-slot="grid-cell">Inactive</div>
				</div>
			</div>
		</section>

		<!-- Static Tree Mockup -->
		<section aria-label="Tree static preview">
			<h2>Tree (static preview)</h2>
			<div data-slot="tree" inert>
				<div data-slot="tree-item">src/</div>
				<div data-slot="tree-item-group">
					<div data-slot="tree-item" style="padding-left: 1.5rem;">app/</div>
					<div data-slot="tree-item-group">
						<div data-slot="tree-item" style="padding-left: 3rem;">app.component.ts</div>
						<div data-slot="tree-item" style="padding-left: 3rem;" data-state="selected">app.routes.ts</div>
					</div>
					<div data-slot="tree-item" style="padding-left: 1.5rem;">assets/</div>
				</div>
			</div>
		</section>

		<!-- Static Toolbar Mockup -->
		<section aria-label="Toolbar static preview">
			<h2>Toolbar (static preview)</h2>
			<div data-slot="toolbar" inert>
				<div data-slot="toolbar-widget">B</div>
				<div data-slot="toolbar-widget">I</div>
				<div data-slot="toolbar-widget">U</div>
				<div data-slot="separator" data-orientation="vertical" style="height: 1.5rem; width: 1px;"></div>
				<div data-slot="toolbar-widget-group">
					<div data-slot="toolbar-widget">L</div>
					<div data-slot="toolbar-widget">C</div>
					<div data-slot="toolbar-widget">R</div>
				</div>
			</div>
		</section>
	`,
})
export class ComponentsShowcaseComponent {}
