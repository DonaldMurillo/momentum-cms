import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

// Form Components
import { Button } from '../button/button.component';
import { Input } from '../input/input.component';
import { Textarea } from '../textarea/textarea.component';
import { Checkbox } from '../checkbox/checkbox.component';
import { Switch } from '../switch/switch.component';
import { Select } from '../select/select.component';
import { RadioGroup } from '../radio-group/radio-group.component';
import { Label } from '../label/label.component';

// Container Components
import { Card } from '../card/card.component';
import { CardHeader } from '../card/card-header.component';
import { CardTitle } from '../card/card-title.component';
import { CardDescription } from '../card/card-description.component';
import { CardContent } from '../card/card-content.component';
import { CardFooter } from '../card/card-footer.component';

import { Alert } from '../alert/alert.component';
import { AlertTitle } from '../alert/alert-title.component';
import { AlertDescription } from '../alert/alert-description.component';

// Feedback Components
import { ToastService } from '../toast/toast.service';
import { ToastContainer } from '../toast/toast-container.component';
import { Spinner } from '../spinner/spinner.component';
import { Skeleton } from '../skeleton/skeleton.component';
import { Progress } from '../progress/progress.component';
import { EmptyState } from '../empty-state/empty-state.component';

// Overlay Components
import { TooltipTrigger } from '../tooltip/tooltip-trigger.directive';
import { PopoverTrigger } from '../popover/popover-trigger.directive';
import { PopoverContent } from '../popover/popover-content.component';
import { DropdownTrigger } from '../dropdown-menu/dropdown-trigger.directive';
import { DropdownMenu } from '../dropdown-menu/dropdown-menu.component';
import { DropdownMenuItem } from '../dropdown-menu/dropdown-menu-item.component';
import { DropdownSeparator } from '../dropdown-menu/dropdown-separator.component';
import { DropdownLabel } from '../dropdown-menu/dropdown-label.component';
import { ConfirmationService } from '../confirmation-dialog/confirmation.service';

// Navigation Components
import { Tabs } from '../tabs/tabs.component';
import { TabsList } from '../tabs/tabs-list.component';
import { TabsTrigger } from '../tabs/tabs-trigger.component';
import { TabsContent } from '../tabs/tabs-content.component';

import { Accordion } from '../accordion/accordion.component';
import { AccordionItem } from '../accordion/accordion-item.component';
import { AccordionTrigger } from '../accordion/accordion-trigger.component';
import { AccordionContent } from '../accordion/accordion-content.component';

import { Breadcrumbs } from '../breadcrumbs/breadcrumbs.component';
import { BreadcrumbItem } from '../breadcrumbs/breadcrumb-item.component';
import { BreadcrumbSeparator } from '../breadcrumbs/breadcrumb-separator.component';

import { Pagination } from '../pagination/pagination.component';

// Data Display Components
import { Table } from '../table/table.component';
import { TableHeader } from '../table/table-header.component';
import { TableBody } from '../table/table-body.component';
import { TableRow } from '../table/table-row.component';
import { TableHead } from '../table/table-head.component';
import { TableCell } from '../table/table-cell.component';
import { TableCaption } from '../table/table-caption.component';

import { Badge } from '../badge/badge.component';
import { Avatar } from '../avatar/avatar.component';
import { AvatarFallback } from '../avatar/avatar-fallback.component';
import { Separator } from '../separator/separator.component';

// Complex Components
import { Command } from '../command/command.component';
import { CommandInput } from '../command/command-input.component';
import { CommandList } from '../command/command-list.component';
import { CommandEmpty } from '../command/command-empty.component';
import { CommandGroup } from '../command/command-group.component';
import { CommandItem } from '../command/command-item.component';
import { CommandSeparator } from '../command/command-separator.component';

/**
 * Kitchen Sink page showcasing all UI components.
 *
 * @example
 * ```typescript
 * // In routing:
 * { path: 'kitchen-sink', loadComponent: () => import('@momentum-cms/ui').then(m => m.KitchenSinkPage) }
 * ```
 */
@Component({
	selector: 'mcms-kitchen-sink-page',
	imports: [
		// Form
		Button,
		Input,
		Textarea,
		Checkbox,
		Switch,
		Select,
		RadioGroup,
		Label,
		// Card
		Card,
		CardHeader,
		CardTitle,
		CardDescription,
		CardContent,
		CardFooter,
		// Alert
		Alert,
		AlertTitle,
		AlertDescription,
		// Toast
		ToastContainer,
		// Feedback
		Spinner,
		Skeleton,
		Progress,
		EmptyState,
		// Tooltip
		TooltipTrigger,
		// Popover
		PopoverTrigger,
		PopoverContent,
		// Dropdown
		DropdownTrigger,
		DropdownMenu,
		DropdownMenuItem,
		DropdownSeparator,
		DropdownLabel,
		// Tabs
		Tabs,
		TabsList,
		TabsTrigger,
		TabsContent,
		// Accordion
		Accordion,
		AccordionItem,
		AccordionTrigger,
		AccordionContent,
		// Breadcrumbs
		Breadcrumbs,
		BreadcrumbItem,
		BreadcrumbSeparator,
		// Pagination
		Pagination,
		// Table
		Table,
		TableHeader,
		TableBody,
		TableRow,
		TableHead,
		TableCell,
		TableCaption,
		// Data Display
		Badge,
		Avatar,
		AvatarFallback,
		Separator,
		// Command
		Command,
		CommandInput,
		CommandList,
		CommandEmpty,
		CommandGroup,
		CommandItem,
		CommandSeparator,
	],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'block min-h-screen bg-background text-foreground',
		ngSkipHydration: 'true',
		'(document:keydown)': 'handleKeyboardShortcut($event)',
	},
	template: `
		<mcms-toast-container />

		<div class="container mx-auto px-4 py-8 max-w-6xl">
			<header class="mb-12">
				<h1 class="text-4xl font-bold mb-2">Kitchen Sink</h1>
				<p class="text-muted-foreground text-lg">
					A comprehensive showcase of all UI components in the library.
				</p>
			</header>

			<!-- Buttons Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Buttons</h2>
				<mcms-separator class="mb-6" />

				<div class="space-y-4">
					<div class="flex flex-wrap gap-3">
						<button mcms-button variant="primary">Primary</button>
						<button mcms-button variant="secondary">Secondary</button>
						<button mcms-button variant="destructive">Destructive</button>
						<button mcms-button variant="outline">Outline</button>
						<button mcms-button variant="ghost">Ghost</button>
						<button mcms-button variant="link">Link</button>
					</div>

					<div class="flex flex-wrap gap-3 items-center">
						<button mcms-button size="sm">Small</button>
						<button mcms-button size="md">Medium</button>
						<button mcms-button size="lg">Large</button>
						<button mcms-button size="icon">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								width="16"
								height="16"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
							>
								<path d="M5 12h14" />
								<path d="M12 5v14" />
							</svg>
						</button>
						<button mcms-button [disabled]="true">Disabled</button>
					</div>
				</div>
			</section>

			<!-- Form Inputs Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Form Inputs</h2>
				<mcms-separator class="mb-6" />

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<div class="space-y-2">
						<mcms-label>Text Input</mcms-label>
						<mcms-input placeholder="Enter text..." />
					</div>

					<div class="space-y-2">
						<mcms-label>Disabled Input</mcms-label>
						<mcms-input placeholder="Disabled..." [disabled]="true" />
					</div>

					<div class="space-y-2 md:col-span-2">
						<mcms-label>Textarea</mcms-label>
						<mcms-textarea placeholder="Enter longer text..." />
					</div>

					<div class="flex items-center gap-4">
						<mcms-checkbox>Remember me</mcms-checkbox>
						<mcms-checkbox [value]="true">Checked</mcms-checkbox>
						<mcms-checkbox [disabled]="true">Disabled</mcms-checkbox>
					</div>

					<div class="flex items-center gap-4">
						<mcms-switch>Notifications</mcms-switch>
						<mcms-switch [value]="true">Enabled</mcms-switch>
					</div>

					<div class="space-y-2">
						<mcms-label>Select</mcms-label>
						<mcms-select [options]="selectOptions" placeholder="Choose an option" />
					</div>

					<div class="space-y-2">
						<mcms-label>Radio Group</mcms-label>
						<mcms-radio-group [options]="radioOptions" />
					</div>
				</div>
			</section>

			<!-- Cards Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Cards</h2>
				<mcms-separator class="mb-6" />

				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Basic Card</mcms-card-title>
							<mcms-card-description>A simple card with content.</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<p>This is the card content area where you can place any content.</p>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Card with Footer</mcms-card-title>
							<mcms-card-description>This card has action buttons.</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<p>Cards can contain forms, images, or any other content.</p>
						</mcms-card-content>
						<mcms-card-footer class="flex gap-2">
							<button mcms-button variant="outline">Cancel</button>
							<button mcms-button>Save</button>
						</mcms-card-footer>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Interactive Card</mcms-card-title>
							<mcms-card-description>With form elements.</mcms-card-description>
						</mcms-card-header>
						<mcms-card-content>
							<div class="space-y-2">
								<mcms-label>Email</mcms-label>
								<mcms-input type="email" placeholder="email@example.com" />
							</div>
						</mcms-card-content>
						<mcms-card-footer>
							<button mcms-button class="w-full">Subscribe</button>
						</mcms-card-footer>
					</mcms-card>
				</div>
			</section>

			<!-- Alerts Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Alerts</h2>
				<mcms-separator class="mb-6" />

				<div class="space-y-4">
					<mcms-alert variant="default">
						<mcms-alert-title>Default Alert</mcms-alert-title>
						<mcms-alert-description
							>This is a default informational alert message.</mcms-alert-description
						>
					</mcms-alert>

					<mcms-alert variant="success">
						<mcms-alert-title>Success!</mcms-alert-title>
						<mcms-alert-description
							>Your changes have been saved successfully.</mcms-alert-description
						>
					</mcms-alert>

					<mcms-alert variant="warning">
						<mcms-alert-title>Warning</mcms-alert-title>
						<mcms-alert-description
							>Please review your input before proceeding.</mcms-alert-description
						>
					</mcms-alert>

					<mcms-alert variant="destructive">
						<mcms-alert-title>Error</mcms-alert-title>
						<mcms-alert-description>Something went wrong. Please try again.</mcms-alert-description>
					</mcms-alert>
				</div>
			</section>

			<!-- Feedback Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Feedback</h2>
				<mcms-separator class="mb-6" />

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Spinners</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="flex items-center gap-4">
							<mcms-spinner size="sm" />
							<mcms-spinner size="md" />
							<mcms-spinner size="lg" />
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Progress</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="space-y-3">
							<mcms-progress [value]="25" />
							<mcms-progress [value]="50" />
							<mcms-progress [value]="75" />
						</mcms-card-content>
					</mcms-card>

					<mcms-card class="md:col-span-2">
						<mcms-card-header>
							<mcms-card-title>Skeleton Loading</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content>
							<div class="flex items-center gap-4">
								<mcms-skeleton class="h-12 w-12 rounded-full" />
								<div class="space-y-2 flex-1">
									<mcms-skeleton class="h-4 w-[250px]" />
									<mcms-skeleton class="h-4 w-[200px]" />
								</div>
							</div>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Toasts</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="flex flex-wrap gap-2">
							<button mcms-button variant="outline" (click)="showToast('default')">Default</button>
							<button mcms-button variant="outline" (click)="showToast('success')">Success</button>
							<button mcms-button variant="outline" (click)="showToast('error')">Error</button>
							<button mcms-button variant="outline" (click)="showToast('warning')">Warning</button>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Dialogs</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="flex flex-wrap gap-2">
							<button mcms-button variant="outline" (click)="openDialog()">Open Dialog</button>
							<button mcms-button variant="outline" (click)="showConfirmation()">
								Confirmation
							</button>
						</mcms-card-content>
					</mcms-card>
				</div>
			</section>

			<!-- Badges & Avatars Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Badges & Avatars</h2>
				<mcms-separator class="mb-6" />

				<div class="grid grid-cols-1 md:grid-cols-2 gap-6">
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Badges</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="flex flex-wrap gap-2">
							<mcms-badge variant="default">Default</mcms-badge>
							<mcms-badge variant="secondary">Secondary</mcms-badge>
							<mcms-badge variant="success">Success</mcms-badge>
							<mcms-badge variant="warning">Warning</mcms-badge>
							<mcms-badge variant="destructive">Destructive</mcms-badge>
							<mcms-badge variant="outline">Outline</mcms-badge>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Avatars</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content class="flex items-center gap-4">
							<mcms-avatar size="sm">
								<mcms-avatar-fallback [delayMs]="0">SM</mcms-avatar-fallback>
							</mcms-avatar>
							<mcms-avatar size="md">
								<mcms-avatar-fallback [delayMs]="0">MD</mcms-avatar-fallback>
							</mcms-avatar>
							<mcms-avatar size="lg">
								<mcms-avatar-fallback [delayMs]="0">LG</mcms-avatar-fallback>
							</mcms-avatar>
						</mcms-card-content>
					</mcms-card>
				</div>
			</section>

			<!-- Navigation Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Navigation</h2>
				<mcms-separator class="mb-6" />

				<div class="space-y-6">
					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Breadcrumbs</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-breadcrumbs>
								<mcms-breadcrumb-item href="#">Home</mcms-breadcrumb-item>
								<mcms-breadcrumb-separator />
								<mcms-breadcrumb-item href="#">Products</mcms-breadcrumb-item>
								<mcms-breadcrumb-separator />
								<mcms-breadcrumb-item [current]="true">Details</mcms-breadcrumb-item>
							</mcms-breadcrumbs>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Tabs</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-tabs defaultValue="tab1">
								<mcms-tabs-list>
									<mcms-tabs-trigger value="tab1">Account</mcms-tabs-trigger>
									<mcms-tabs-trigger value="tab2">Password</mcms-tabs-trigger>
									<mcms-tabs-trigger value="tab3">Settings</mcms-tabs-trigger>
								</mcms-tabs-list>
								<mcms-tabs-content value="tab1">
									<p class="text-muted-foreground">Manage your account settings and preferences.</p>
								</mcms-tabs-content>
								<mcms-tabs-content value="tab2">
									<p class="text-muted-foreground">Change your password and security settings.</p>
								</mcms-tabs-content>
								<mcms-tabs-content value="tab3">
									<p class="text-muted-foreground">Configure application settings.</p>
								</mcms-tabs-content>
							</mcms-tabs>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Accordion</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-accordion>
								<mcms-accordion-item value="item-1">
									<mcms-accordion-trigger panelId="item-1"
										>Is it accessible?</mcms-accordion-trigger
									>
									<mcms-accordion-content panelId="item-1">
										Yes. It adheres to the WAI-ARIA design pattern.
									</mcms-accordion-content>
								</mcms-accordion-item>
								<mcms-accordion-item value="item-2">
									<mcms-accordion-trigger panelId="item-2">Is it styled?</mcms-accordion-trigger>
									<mcms-accordion-content panelId="item-2">
										Yes. It comes with default styles using Tailwind CSS.
									</mcms-accordion-content>
								</mcms-accordion-item>
								<mcms-accordion-item value="item-3">
									<mcms-accordion-trigger panelId="item-3">Is it animated?</mcms-accordion-trigger>
									<mcms-accordion-content panelId="item-3">
										Yes. It's animated by default with smooth transitions.
									</mcms-accordion-content>
								</mcms-accordion-item>
							</mcms-accordion>
						</mcms-card-content>
					</mcms-card>

					<mcms-card>
						<mcms-card-header>
							<mcms-card-title>Pagination</mcms-card-title>
						</mcms-card-header>
						<mcms-card-content>
							<mcms-pagination
								[currentPage]="currentPage()"
								[totalPages]="10"
								(pageChange)="currentPage.set($event)"
							/>
						</mcms-card-content>
					</mcms-card>
				</div>
			</section>

			<!-- Overlays Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Overlays</h2>
				<mcms-separator class="mb-6" />

				<div class="flex flex-wrap gap-4">
					<button mcms-button variant="outline" [mcmsTooltip]="'This is a tooltip'">
						Hover for Tooltip
					</button>

					<button mcms-button variant="outline" [mcmsPopoverTrigger]="popoverContent">
						Click for Popover
					</button>
					<ng-template #popoverContent>
						<mcms-popover-content>
							<div class="p-2">
								<p class="font-medium">Popover Content</p>
								<p class="text-sm text-muted-foreground">This is a popover with more content.</p>
							</div>
						</mcms-popover-content>
					</ng-template>

					<button mcms-button variant="outline" [mcmsDropdownTrigger]="dropdownContent">
						Dropdown Menu
					</button>
					<ng-template #dropdownContent>
						<mcms-dropdown-menu>
							<mcms-dropdown-label>My Account</mcms-dropdown-label>
							<mcms-dropdown-separator />
							<button mcms-dropdown-item value="profile">Profile</button>
							<button mcms-dropdown-item value="settings">Settings</button>
							<mcms-dropdown-separator />
							<button mcms-dropdown-item value="logout">Log out</button>
						</mcms-dropdown-menu>
					</ng-template>
				</div>
			</section>

			<!-- Table Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Table</h2>
				<mcms-separator class="mb-6" />

				<mcms-table>
					<mcms-table-caption>A list of recent invoices.</mcms-table-caption>
					<mcms-table-header>
						<mcms-table-row>
							<mcms-table-head>Invoice</mcms-table-head>
							<mcms-table-head>Status</mcms-table-head>
							<mcms-table-head>Method</mcms-table-head>
							<mcms-table-head style="text-align: right;">Amount</mcms-table-head>
						</mcms-table-row>
					</mcms-table-header>
					<mcms-table-body>
						<mcms-table-row>
							<mcms-table-cell style="font-weight: 500;">INV001</mcms-table-cell>
							<mcms-table-cell><mcms-badge variant="success">Paid</mcms-badge></mcms-table-cell>
							<mcms-table-cell>Credit Card</mcms-table-cell>
							<mcms-table-cell style="text-align: right;">$250.00</mcms-table-cell>
						</mcms-table-row>
						<mcms-table-row>
							<mcms-table-cell style="font-weight: 500;">INV002</mcms-table-cell>
							<mcms-table-cell><mcms-badge variant="warning">Pending</mcms-badge></mcms-table-cell>
							<mcms-table-cell>PayPal</mcms-table-cell>
							<mcms-table-cell style="text-align: right;">$150.00</mcms-table-cell>
						</mcms-table-row>
						<mcms-table-row>
							<mcms-table-cell style="font-weight: 500;">INV003</mcms-table-cell>
							<mcms-table-cell
								><mcms-badge variant="destructive">Overdue</mcms-badge></mcms-table-cell
							>
							<mcms-table-cell>Bank Transfer</mcms-table-cell>
							<mcms-table-cell style="text-align: right;">$350.00</mcms-table-cell>
						</mcms-table-row>
					</mcms-table-body>
				</mcms-table>
			</section>

			<!-- Empty State Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Empty State</h2>
				<mcms-separator class="mb-6" />

				<mcms-empty-state
					title="No results found"
					description="Try adjusting your search or filter to find what you're looking for."
					icon="search"
				>
					<button mcms-button variant="outline">Clear filters</button>
				</mcms-empty-state>
			</section>

			<!-- Command Palette Section -->
			<section class="mb-12">
				<h2 class="text-2xl font-semibold mb-4">Command Palette</h2>
				<mcms-separator class="mb-6" />

				<div class="flex flex-col items-center gap-4">
					<p class="text-muted-foreground">
						Press <kbd class="px-2 py-1 bg-muted rounded text-sm font-mono">⌘K</kbd> or click the
						button below
					</p>
					<button mcms-button variant="outline" (click)="openCommandPalette()">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="16"
							height="16"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							class="mr-2"
						>
							<circle cx="11" cy="11" r="8" />
							<path d="m21 21-4.3-4.3" />
						</svg>
						Open Command Palette
					</button>
				</div>

				@if (commandPaletteOpen()) {
					<div
						class="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-[20vh]"
						(click)="closeCommandPalette()"
					>
						<div
							class="w-full max-w-lg"
							(click)="$event.stopPropagation()"
							(keydown)="handleCommandKeydown($event)"
						>
							<mcms-command class="rounded-lg border shadow-lg bg-popover">
								<mcms-command-input
									[autofocus]="true"
									placeholder="Type a command or search..."
									[(value)]="searchQuery"
								/>
								<mcms-command-list>
									@if (allFilteredItems().length === 0) {
										<mcms-command-empty>No results found.</mcms-command-empty>
									}
									@if (filteredSuggestions().length > 0) {
										<mcms-command-group heading="Suggestions">
											@for (item of filteredSuggestions(); track item.value; let i = $index) {
												<mcms-command-item
													[value]="item.value"
													[class.bg-accent]="i === activeIndex()"
													[class.text-accent-foreground]="i === activeIndex()"
													(click)="selectCommandItem(item)"
												>
													{{ item.label }}
												</mcms-command-item>
											}
										</mcms-command-group>
									}
									@if (filteredSuggestions().length > 0 && filteredSettings().length > 0) {
										<mcms-command-separator />
									}
									@if (filteredSettings().length > 0) {
										<mcms-command-group heading="Settings">
											@for (item of filteredSettings(); track item.value; let i = $index) {
												<mcms-command-item
													[value]="item.value"
													[class.bg-accent]="filteredSuggestions().length + i === activeIndex()"
													[class.text-accent-foreground]="
														filteredSuggestions().length + i === activeIndex()
													"
													(click)="selectCommandItem(item)"
												>
													{{ item.label }}
												</mcms-command-item>
											}
										</mcms-command-group>
									}
								</mcms-command-list>
							</mcms-command>
						</div>
					</div>
				}
			</section>
		</div>
	`,
})
export class KitchenSinkPage {
	private readonly toastService = inject(ToastService);
	private readonly confirmationService = inject(ConfirmationService);

	readonly currentPage = signal(1);
	readonly commandPaletteOpen = signal(false);
	readonly searchQuery = signal('');
	readonly activeIndex = signal(0);

	readonly commandItems = [
		{ value: 'calendar', label: 'Calendar', group: 'suggestions' },
		{ value: 'search-emoji', label: 'Search Emoji', group: 'suggestions' },
		{ value: 'calculator', label: 'Calculator', group: 'suggestions' },
		{ value: 'profile', label: 'Profile', group: 'settings' },
		{ value: 'billing', label: 'Billing', group: 'settings' },
		{ value: 'settings', label: 'Settings', group: 'settings' },
	];

	readonly filteredSuggestions = computed(() => {
		const query = this.searchQuery().toLowerCase();
		return this.commandItems
			.filter((item) => item.group === 'suggestions')
			.filter((item) => !query || item.label.toLowerCase().includes(query));
	});

	readonly filteredSettings = computed(() => {
		const query = this.searchQuery().toLowerCase();
		return this.commandItems
			.filter((item) => item.group === 'settings')
			.filter((item) => !query || item.label.toLowerCase().includes(query));
	});

	readonly allFilteredItems = computed(() => [
		...this.filteredSuggestions(),
		...this.filteredSettings(),
	]);

	handleKeyboardShortcut(event: KeyboardEvent): void {
		if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
			event.preventDefault();
			this.commandPaletteOpen.update((open) => !open);
		}
		if (event.key === 'Escape' && this.commandPaletteOpen()) {
			this.closeCommandPalette();
		}
	}

	handleCommandKeydown(event: KeyboardEvent): void {
		const items = this.allFilteredItems();
		if (items.length === 0) return;

		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				this.activeIndex.update((i) => (i + 1) % items.length);
				break;
			case 'ArrowUp':
				event.preventDefault();
				this.activeIndex.update((i) => (i - 1 + items.length) % items.length);
				break;
			case 'Enter': {
				event.preventDefault();
				const item = items[this.activeIndex()];
				if (item) this.selectCommandItem(item);
				break;
			}
		}
	}

	selectCommandItem(item: { value: string; label: string }): void {
		this.toastService.show('Command Selected', `You selected: ${item.label}`);
		this.closeCommandPalette();
	}

	openCommandPalette(): void {
		this.commandPaletteOpen.set(true);
	}

	closeCommandPalette(): void {
		this.commandPaletteOpen.set(false);
		this.searchQuery.set('');
		this.activeIndex.set(0);
	}

	readonly selectOptions = [
		{ value: 'option1', label: 'Option 1' },
		{ value: 'option2', label: 'Option 2' },
		{ value: 'option3', label: 'Option 3' },
	];

	readonly radioOptions = [
		{ value: 'radio1', label: 'Radio 1' },
		{ value: 'radio2', label: 'Radio 2' },
		{ value: 'radio3', label: 'Radio 3' },
	];

	showToast(type: 'default' | 'success' | 'error' | 'warning'): void {
		const messages = {
			default: { title: 'Notification', description: 'This is a default toast message.' },
			success: { title: 'Success!', description: 'Your action was completed successfully.' },
			error: { title: 'Error', description: 'Something went wrong. Please try again.' },
			warning: { title: 'Warning', description: 'Please review before proceeding.' },
		};
		const msg = messages[type];
		switch (type) {
			case 'success':
				this.toastService.success(msg.title, msg.description);
				break;
			case 'error':
				this.toastService.error(msg.title, msg.description);
				break;
			case 'warning':
				this.toastService.warning(msg.title, msg.description);
				break;
			default:
				this.toastService.show(msg.title, msg.description);
		}
	}

	openDialog(): void {
		this.confirmationService.confirm({
			title: 'Example Dialog',
			description:
				'This is a dialog component. In real usage, you can create custom dialog components using DialogService.',
			confirmText: 'Got it',
			cancelText: 'Close',
		});
	}

	showConfirmation(): void {
		this.confirmationService.confirm({
			title: 'Are you sure?',
			description: 'This action cannot be undone.',
			confirmText: 'Yes, continue',
			cancelText: 'Cancel',
		});
	}
}
