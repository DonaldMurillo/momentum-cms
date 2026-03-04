import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
	selector: 'mcms-welcome-page',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'flex min-h-screen flex-col bg-background text-foreground',
	},
	template: `
		<header class="border-b border-border px-6 py-4">
			<div class="mx-auto flex max-w-4xl items-center justify-between">
				<h1 class="text-xl font-bold tracking-tight">Momentum CMS</h1>
				<nav class="flex items-center gap-4">
					<a
						routerLink="/posts"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						Posts
					</a>
					<a
						href="https://github.com/DonaldMurillo/momentum-cms"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						GitHub
					</a>
					<a
						href="https://github.com/DonaldMurillo/momentum-cms/tree/main/docs"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					>
						Docs
					</a>
					<a
						routerLink="/admin"
						class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
					>
						Go to Admin
					</a>
				</nav>
			</div>
		</header>

		<main class="flex-1 px-6 py-12">
			<div class="mx-auto max-w-4xl space-y-12">
				<section class="space-y-4 text-center">
					<h2 class="text-4xl font-bold tracking-tight">Welcome to Momentum CMS</h2>
					<p class="mx-auto max-w-2xl text-lg text-muted-foreground">
						Your Angular-powered headless CMS is ready. Define collections in TypeScript, get an
						auto-generated Admin UI, REST API, and database schema.
					</p>
				</section>

				<section class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
					<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
						<h3 class="mb-2 text-lg font-semibold text-card-foreground">1. Create Admin Account</h3>
						<p class="mb-4 text-sm text-muted-foreground">
							Head to the admin panel to create your first admin account and start managing content.
						</p>
						<a routerLink="/admin" class="text-sm font-medium text-primary hover:underline">
							Open Admin Panel &rarr;
						</a>
					</div>

					<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
						<h3 class="mb-2 text-lg font-semibold text-card-foreground">2. Define Collections</h3>
						<p class="mb-4 text-sm text-muted-foreground">
							Edit <code class="rounded bg-muted px-1.5 py-0.5 text-xs">src/collections/</code> to
							define your content types with fields, hooks, and access control.
						</p>
						<code class="block rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
							text('title', &#123; required: true &#125;)
						</code>
					</div>

					<div class="rounded-lg border border-border bg-card p-6 shadow-sm">
						<h3 class="mb-2 text-lg font-semibold text-card-foreground">3. Generate Types</h3>
						<p class="mb-4 text-sm text-muted-foreground">
							Run the type generator to create TypeScript interfaces from your collection
							definitions.
						</p>
						<code class="block rounded bg-muted px-3 py-2 text-xs text-muted-foreground">
							npm run generate
						</code>
					</div>
				</section>

				<section class="rounded-lg border border-border bg-card p-6 shadow-sm">
					<h3 class="mb-3 text-lg font-semibold text-card-foreground">Quick Reference</h3>
					<div class="grid gap-3 sm:grid-cols-2">
						<div>
							<p class="text-sm font-medium text-card-foreground">Dev Server</p>
							<code class="text-sm text-muted-foreground">npm run dev</code>
						</div>
						<div>
							<p class="text-sm font-medium text-card-foreground">Production Build</p>
							<code class="text-sm text-muted-foreground">npm run build</code>
						</div>
						<div>
							<p class="text-sm font-medium text-card-foreground">Config File</p>
							<code class="text-sm text-muted-foreground">src/momentum.config.ts</code>
						</div>
						<div>
							<p class="text-sm font-medium text-card-foreground">REST API</p>
							<code class="text-sm text-muted-foreground">/api/collections/:slug</code>
						</div>
					</div>
				</section>
			</div>
		</main>

		<footer class="border-t border-border px-6 py-6">
			<div
				class="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between"
			>
				<p class="text-sm text-muted-foreground">
					Powered by Momentum CMS &mdash; Built with Angular, Drizzle ORM, and Better Auth
				</p>
				<nav class="flex items-center gap-4">
					<a
						routerLink="/posts"
						class="text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						Posts
					</a>
					<a
						href="https://github.com/DonaldMurillo/momentum-cms"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						GitHub
					</a>
					<a
						href="https://github.com/DonaldMurillo/momentum-cms/tree/main/docs"
						target="_blank"
						rel="noopener noreferrer"
						class="text-sm text-muted-foreground transition-colors hover:text-foreground"
					>
						Documentation
					</a>
				</nav>
			</div>
		</footer>
	`,
})
export class WelcomePage {}
