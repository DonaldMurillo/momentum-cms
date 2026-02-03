import { Component, ChangeDetectionStrategy } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
	selector: 'app-landing-page',
	imports: [RouterLink],
	changeDetection: ChangeDetectionStrategy.OnPush,
	template: `
		<div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
			<!-- Header -->
			<header class="border-b border-slate-700/50">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
					<div class="flex items-center justify-between">
						<div class="flex items-center gap-3">
							<div
								class="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center"
							>
								<span class="text-white font-bold text-xl">M</span>
							</div>
							<span class="text-white font-semibold text-xl">Momentum CMS</span>
						</div>
						<div class="flex items-center gap-3">
							<a
								href="/storybook"
								class="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
							>
								Component Library
							</a>
							<a
								routerLink="/admin"
								class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
							>
								Open Admin
							</a>
						</div>
					</div>
				</div>
			</header>

			<!-- Hero Section -->
			<main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
				<div class="text-center mb-16">
					<h1 class="text-5xl font-bold text-white mb-6">
						Angular-Powered
						<span
							class="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400"
						>
							Headless CMS
						</span>
					</h1>
					<p class="text-xl text-slate-300 max-w-3xl mx-auto mb-8">
						Define collections in TypeScript, auto-generate Admin UI, REST API, and database schema.
						Inspired by Payload CMS, built for Angular.
					</p>
					<div class="flex gap-4 justify-center">
						<a
							routerLink="/admin"
							class="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
						>
							<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 10V3L4 14h7v7l9-11h-7z"
								/>
							</svg>
							Go to Admin Panel
						</a>
						<a
							href="https://github.com/momentum-cms/momentum"
							target="_blank"
							class="px-6 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
						>
							<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
								<path
									d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"
								/>
							</svg>
							View on GitHub
						</a>
					</div>
				</div>

				<!-- Feature Cards -->
				<div class="grid md:grid-cols-3 gap-6 mb-16">
					<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
						<div
							class="w-12 h-12 bg-indigo-500/20 rounded-lg flex items-center justify-center mb-4"
						>
							<svg
								class="w-6 h-6 text-indigo-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
								/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-white mb-2">Type-Safe Collections</h3>
						<p class="text-slate-400">
							Define your data models in TypeScript with full type safety. Collections auto-generate
							database schemas and API endpoints.
						</p>
					</div>

					<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
						<div
							class="w-12 h-12 bg-purple-500/20 rounded-lg flex items-center justify-center mb-4"
						>
							<svg
								class="w-6 h-6 text-purple-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"
								/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-white mb-2">Auto-Generated Admin UI</h3>
						<p class="text-slate-400">
							A beautiful admin dashboard is generated automatically from your collection
							definitions. No manual form building required.
						</p>
					</div>

					<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
						<div class="w-12 h-12 bg-green-500/20 rounded-lg flex items-center justify-center mb-4">
							<svg
								class="w-6 h-6 text-green-400"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
								/>
							</svg>
						</div>
						<h3 class="text-lg font-semibold text-white mb-2">REST API Ready</h3>
						<p class="text-slate-400">
							Full CRUD API endpoints are generated for each collection. Works with Express,
							Analog.js, or any Node.js framework.
						</p>
					</div>
				</div>

				<!-- Quick Start -->
				<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-8">
					<h2 class="text-2xl font-bold text-white mb-6">Quick Start</h2>

					<div class="space-y-6">
						<div>
							<h3 class="text-lg font-semibold text-indigo-400 mb-3">1. Define a Collection</h3>
							<pre
								class="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm"
							><code class="text-slate-300">import {{ '{' }} defineCollection, text, textarea {{ '}' }} from '&#64;momentum-cms/core';

export const Posts = defineCollection({{ '{' }}
  slug: 'posts',
  fields: [
    text('title', {{ '{' }} required: true {{ '}' }}),
    text('slug', {{ '{' }} required: true {{ '}' }}),
    textarea('content'),
  ],
{{ '}' }});</code></pre>
						</div>

						<div>
							<h3 class="text-lg font-semibold text-indigo-400 mb-3">2. Configure Momentum</h3>
							<pre
								class="bg-slate-900 rounded-lg p-4 overflow-x-auto text-sm"
							><code class="text-slate-300">import {{ '{' }} defineMomentumConfig {{ '}' }} from '&#64;momentum-cms/core';
import {{ '{' }} sqliteAdapter {{ '}' }} from '&#64;momentum-cms/db-drizzle';

export default defineMomentumConfig({{ '{' }}
  db: {{ '{' }} adapter: sqliteAdapter({{ '{' }} filename: './data/cms.db' {{ '}' }}) {{ '}' }},
  collections: [Posts],
{{ '}' }});</code></pre>
						</div>

						<div>
							<h3 class="text-lg font-semibold text-indigo-400 mb-3">3. Try the API</h3>
							<div class="grid md:grid-cols-2 gap-4">
								<div class="bg-slate-900 rounded-lg p-4">
									<p class="text-slate-400 text-sm mb-2">List all posts:</p>
									<code class="text-green-400 text-sm">GET /api/posts</code>
								</div>
								<div class="bg-slate-900 rounded-lg p-4">
									<p class="text-slate-400 text-sm mb-2">Create a post:</p>
									<code class="text-green-400 text-sm">POST /api/posts</code>
								</div>
								<div class="bg-slate-900 rounded-lg p-4">
									<p class="text-slate-400 text-sm mb-2">Get single post:</p>
									<code class="text-green-400 text-sm">GET /api/posts/:id</code>
								</div>
								<div class="bg-slate-900 rounded-lg p-4">
									<p class="text-slate-400 text-sm mb-2">Update a post:</p>
									<code class="text-green-400 text-sm">PATCH /api/posts/:id</code>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Collections in this demo -->
				<div class="mt-12">
					<h2 class="text-2xl font-bold text-white mb-6 text-center">Collections in This Demo</h2>
					<div class="grid md:grid-cols-2 gap-6">
						<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
							<div class="flex items-center gap-3 mb-4">
								<div class="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
									<svg
										class="w-5 h-5 text-blue-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
										/>
									</svg>
								</div>
								<h3 class="text-lg font-semibold text-white">Posts</h3>
							</div>
							<p class="text-slate-400 mb-4">
								Blog posts with title, slug, content, status, and featured flag.
							</p>
							<a
								routerLink="/admin/collections/posts"
								class="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
							>
								Manage Posts &rarr;
							</a>
						</div>

						<div class="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6">
							<div class="flex items-center gap-3 mb-4">
								<div
									class="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center"
								>
									<svg
										class="w-5 h-5 text-emerald-400"
										fill="none"
										stroke="currentColor"
										viewBox="0 0 24 24"
									>
										<path
											stroke-linecap="round"
											stroke-linejoin="round"
											stroke-width="2"
											d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
										/>
									</svg>
								</div>
								<h3 class="text-lg font-semibold text-white">Users</h3>
							</div>
							<p class="text-slate-400 mb-4">
								User accounts with name, email, role, and active status.
							</p>
							<a
								routerLink="/admin/collections/users"
								class="text-indigo-400 hover:text-indigo-300 text-sm font-medium"
							>
								Manage Users &rarr;
							</a>
						</div>
					</div>
				</div>
			</main>

			<!-- Footer -->
			<footer class="border-t border-slate-700/50 mt-20">
				<div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
					<div class="flex items-center justify-between">
						<p class="text-slate-400 text-sm">Built with Angular 21, Drizzle ORM, and SQLite</p>
						<div class="flex items-center gap-4">
							<span class="text-slate-500 text-sm">Momentum CMS</span>
						</div>
					</div>
				</div>
			</footer>
		</div>
	`,
})
export class LandingPage {}
