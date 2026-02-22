/**
 * Comprehensive unit tests for LivePreviewComponent.
 *
 * Tests computed signals (previewUrl, iframeWidth, sandboxValue),
 * device size toggling, refresh mechanics, and message handling.
 *
 * Uses TestBed.overrideComponent to strip the template and avoid
 * rendering iframes in jsdom where they cannot function.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LivePreviewComponent } from '../live-preview.component';
import type { Signal } from '@angular/core';

/**
 * Type-safe accessor for private members on the component instance.
 * Routes through `unknown` to satisfy strict TS without direct narrowing cast.
 */
function getPrivateMember<T>(instance: unknown, key: string): T {
	return (instance as Record<string, unknown>)[key] as T;
}

/** Type for the spy on window.addEventListener / removeEventListener */
type WindowEventSpy = ReturnType<typeof vi.spyOn>;

describe('LivePreviewComponent', () => {
	let fixture: ComponentFixture<LivePreviewComponent>;
	let component: LivePreviewComponent;
	let addEventListenerSpy: WindowEventSpy;
	let removeEventListenerSpy: WindowEventSpy;

	beforeEach(async () => {
		// Spy on window event listeners so we can capture the message handler
		addEventListenerSpy = vi.spyOn(window, 'addEventListener');
		removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

		await TestBed.configureTestingModule({
			imports: [LivePreviewComponent],
		}).compileComponents();

		TestBed.overrideComponent(LivePreviewComponent, {
			set: { template: '<div></div>', imports: [] },
		});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	/**
	 * Helper to create the fixture and set all required inputs.
	 * Calls detectChanges after setting inputs.
	 */
	function createComponent(opts: {
		preview: boolean | string | ((doc: Record<string, unknown>) => string);
		documentData: Record<string, unknown>;
		collectionSlug: string;
		entityId?: string;
	}): void {
		fixture = TestBed.createComponent(LivePreviewComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('preview', opts.preview);
		fixture.componentRef.setInput('documentData', opts.documentData);
		fixture.componentRef.setInput('collectionSlug', opts.collectionSlug);
		if (opts.entityId !== undefined) {
			fixture.componentRef.setInput('entityId', opts.entityId);
		}
		fixture.detectChanges();
	}

	/**
	 * Helper to extract the message event handler from the spied addEventListener calls.
	 */
	function getMessageHandler(): (event: MessageEvent) => void {
		const messageCall = addEventListenerSpy.mock.calls.find(
			(call: unknown[]) => call[0] === 'message',
		);
		return messageCall?.[1] as (event: MessageEvent) => void;
	}

	// ---------------------------------------------------------------
	// previewUrl computed - function config
	// ---------------------------------------------------------------
	describe('previewUrl computed - function config', () => {
		it('should return URL from a function that receives documentData', () => {
			const fn = (doc: Record<string, unknown>): string => `/preview/${String(doc['slug'])}`;
			createComponent({
				preview: fn,
				documentData: { slug: 'hello-world' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBe('/preview/hello-world');
		});

		it('should pass the full documentData object to the function', () => {
			const spy = vi.fn(
				(doc: Record<string, unknown>): string =>
					`/p/${String(doc['id'])}/${String(doc['locale'])}`,
			);
			createComponent({
				preview: spy,
				documentData: { id: '42', locale: 'en', title: 'Test' },
				collectionSlug: 'articles',
			});

			// The computed is lazy; reading previewUrl() triggers the function call
			expect(component.previewUrl()).toBe('/p/42/en');
			expect(spy).toHaveBeenCalledWith({ id: '42', locale: 'en', title: 'Test' });
		});

		it('should return null when the function throws an error', () => {
			const throwingFn = (): string => {
				throw new Error('Preview generation failed');
			};
			createComponent({
				preview: throwingFn,
				documentData: { slug: 'test' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should return null when the function throws a non-Error value', () => {
			const throwingFn = (): string => {
				throw 'string error';
			};
			createComponent({
				preview: throwingFn,
				documentData: {},
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// previewUrl computed - string template config
	// ---------------------------------------------------------------
	describe('previewUrl computed - string template config', () => {
		it('should interpolate {field} placeholders with documentData values', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: 'my-post' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBe('/posts/my-post');
		});

		it('should interpolate multiple placeholders', () => {
			createComponent({
				preview: '/{locale}/articles/{slug}',
				documentData: { locale: 'en', slug: 'hello' },
				collectionSlug: 'articles',
			});

			expect(component.previewUrl()).toBe('/en/articles/hello');
		});

		it('should convert non-string values to strings', () => {
			createComponent({
				preview: '/items/{id}',
				documentData: { id: 123 },
				collectionSlug: 'items',
			});

			expect(component.previewUrl()).toBe('/items/123');
		});

		it('should return null when a placeholder field is null', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: null },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should return null when a placeholder field is undefined', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: {},
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should return null when a placeholder field is an empty string', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: '' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should return null when any one of multiple placeholders is empty', () => {
			createComponent({
				preview: '/{locale}/posts/{slug}',
				documentData: { locale: 'en', slug: '' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should handle a string with no placeholders as a static URL', () => {
			createComponent({
				preview: 'https://example.com/preview',
				documentData: {},
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBe('https://example.com/preview');
		});
	});

	// ---------------------------------------------------------------
	// previewUrl computed - boolean true config
	// ---------------------------------------------------------------
	describe('previewUrl computed - boolean true config', () => {
		it('should return /api/{slug}/{id}/preview when entityId is provided', () => {
			createComponent({
				preview: true,
				documentData: { title: 'Test' },
				collectionSlug: 'pages',
				entityId: 'abc123',
			});

			expect(component.previewUrl()).toBe('/api/pages/abc123/preview');
		});

		it('should use the collectionSlug in the URL', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'articles',
				entityId: '99',
			});

			expect(component.previewUrl()).toBe('/api/articles/99/preview');
		});

		it('should return null when entityId is undefined', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
			});

			expect(component.previewUrl()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// previewUrl computed - boolean false / other
	// ---------------------------------------------------------------
	describe('previewUrl computed - boolean false / other', () => {
		it('should return null for preview: false', () => {
			createComponent({
				preview: false,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.previewUrl()).toBeNull();
		});

		it('should return null for preview: false even with entityId', () => {
			createComponent({
				preview: false,
				documentData: { id: '1' },
				collectionSlug: 'posts',
				entityId: '1',
			});

			expect(component.previewUrl()).toBeNull();
		});
	});

	// ---------------------------------------------------------------
	// iframeWidth computed
	// ---------------------------------------------------------------
	describe('iframeWidth computed', () => {
		it('should return "100%" for desktop (default)', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.iframeWidth()).toBe('100%');
		});

		it('should return "768px" for tablet', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});
			component.deviceSize.set('tablet');

			expect(component.iframeWidth()).toBe('768px');
		});

		it('should return "375px" for mobile', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});
			component.deviceSize.set('mobile');

			expect(component.iframeWidth()).toBe('375px');
		});

		it('should reactively update when deviceSize changes', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.iframeWidth()).toBe('100%');

			component.deviceSize.set('mobile');
			expect(component.iframeWidth()).toBe('375px');

			component.deviceSize.set('tablet');
			expect(component.iframeWidth()).toBe('768px');

			component.deviceSize.set('desktop');
			expect(component.iframeWidth()).toBe('100%');
		});
	});

	// ---------------------------------------------------------------
	// refreshPreview
	// ---------------------------------------------------------------
	describe('refreshPreview', () => {
		it('should cause previewUrl to recompute (verifiable via function call count)', () => {
			let callCount = 0;
			const fn = (doc: Record<string, unknown>): string => {
				callCount++;
				return `/preview/${String(doc['slug'])}`;
			};
			createComponent({
				preview: fn,
				documentData: { slug: 'test' },
				collectionSlug: 'posts',
			});

			// Initial computation
			const initialCount = callCount;
			expect(component.previewUrl()).toBe('/preview/test');

			// Trigger refresh and reread the computed
			component.refreshPreview();
			const urlAfterRefresh = component.previewUrl();

			expect(urlAfterRefresh).toBe('/preview/test');
			expect(callCount).toBeGreaterThan(initialCount);
		});

		it('should be callable multiple times', () => {
			let callCount = 0;
			const fn = (): string => {
				callCount++;
				return '/preview';
			};
			createComponent({
				preview: fn,
				documentData: {},
				collectionSlug: 'posts',
			});

			// Read to establish baseline
			component.previewUrl();
			const baseCount = callCount;

			component.refreshPreview();
			component.previewUrl();
			component.refreshPreview();
			component.previewUrl();

			expect(callCount).toBeGreaterThan(baseCount);
		});
	});

	// ---------------------------------------------------------------
	// deviceSize signal
	// ---------------------------------------------------------------
	describe('deviceSize signal', () => {
		it('should default to "desktop"', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.deviceSize()).toBe('desktop');
		});

		it('should be settable to "tablet"', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			component.deviceSize.set('tablet');
			expect(component.deviceSize()).toBe('tablet');
		});

		it('should be settable to "mobile"', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			component.deviceSize.set('mobile');
			expect(component.deviceSize()).toBe('mobile');
		});

		it('should be settable back to "desktop" from another size', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			component.deviceSize.set('mobile');
			expect(component.deviceSize()).toBe('mobile');

			component.deviceSize.set('desktop');
			expect(component.deviceSize()).toBe('desktop');
		});
	});

	// ---------------------------------------------------------------
	// sandboxValue computed (private, accessed via helper)
	// ---------------------------------------------------------------
	describe('sandboxValue computed', () => {
		it('should include allow-scripts when preview config is boolean true', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toBe('allow-same-origin allow-scripts allow-popups allow-forms');
		});

		it('should not include allow-scripts when preview config is a string', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: 'test' },
				collectionSlug: 'posts',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toBe('allow-same-origin allow-popups allow-forms');
			expect(sandboxValue()).not.toContain('allow-scripts');
		});

		it('should not include allow-scripts when preview config is a function', () => {
			createComponent({
				preview: (): string => '/preview',
				documentData: {},
				collectionSlug: 'posts',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toBe('allow-same-origin allow-popups allow-forms');
			expect(sandboxValue()).not.toContain('allow-scripts');
		});

		it('should not include allow-scripts when preview config is boolean false', () => {
			createComponent({
				preview: false,
				documentData: {},
				collectionSlug: 'posts',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toBe('allow-same-origin allow-popups allow-forms');
		});

		it('should always include allow-same-origin', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toContain('allow-same-origin');
		});

		it('should always include allow-popups', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: 'test' },
				collectionSlug: 'posts',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toContain('allow-popups');
		});

		it('should always include allow-forms', () => {
			createComponent({
				preview: (): string => '/preview',
				documentData: {},
				collectionSlug: 'posts',
			});

			const sandboxValue = getPrivateMember<Signal<string>>(component, 'sandboxValue');
			expect(sandboxValue()).toContain('allow-forms');
		});
	});

	// ---------------------------------------------------------------
	// Message listener (editBlockRequest)
	// ---------------------------------------------------------------
	describe('editBlockRequest message listener', () => {
		it('should register a message event listener on the window', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
		});

		it('should emit editBlockRequest when receiving a valid momentum-edit-block message', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: window.location.origin,
				data: { type: 'momentum-edit-block', blockIndex: 3 },
			} as unknown as MessageEvent);

			expect(emitSpy).toHaveBeenCalledWith(3);
		});

		it('should not emit for messages with wrong origin', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: 'https://evil.com',
				data: { type: 'momentum-edit-block', blockIndex: 0 },
			} as unknown as MessageEvent);

			expect(emitSpy).not.toHaveBeenCalled();
		});

		it('should not emit for messages with wrong type', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: window.location.origin,
				data: { type: 'some-other-message', blockIndex: 0 },
			} as unknown as MessageEvent);

			expect(emitSpy).not.toHaveBeenCalled();
		});

		it('should not emit when blockIndex is not a number', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: window.location.origin,
				data: { type: 'momentum-edit-block', blockIndex: 'not-a-number' },
			} as unknown as MessageEvent);

			expect(emitSpy).not.toHaveBeenCalled();
		});

		it('should not emit when blockIndex is missing', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: window.location.origin,
				data: { type: 'momentum-edit-block' },
			} as unknown as MessageEvent);

			expect(emitSpy).not.toHaveBeenCalled();
		});

		it('should emit for blockIndex of 0 (falsy but valid number)', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const emitSpy = vi.spyOn(component.editBlockRequest, 'emit');
			const handler = getMessageHandler();

			handler({
				origin: window.location.origin,
				data: { type: 'momentum-edit-block', blockIndex: 0 },
			} as unknown as MessageEvent);

			expect(emitSpy).toHaveBeenCalledWith(0);
		});
	});

	// ---------------------------------------------------------------
	// Debounce timer cleanup
	// ---------------------------------------------------------------
	describe('debounce timer cleanup', () => {
		it('should have debounceTimer initially undefined', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			const timer = getPrivateMember<number | undefined>(component, 'debounceTimer');
			expect(timer).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// previewUrl reactivity to input changes
	// ---------------------------------------------------------------
	describe('previewUrl reactivity', () => {
		it('should update when documentData changes for string template', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: { slug: 'old-slug' },
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBe('/posts/old-slug');

			fixture.componentRef.setInput('documentData', { slug: 'new-slug' });
			fixture.detectChanges();

			expect(component.previewUrl()).toBe('/posts/new-slug');
		});

		it('should update when entityId changes for boolean preview', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.previewUrl()).toBe('/api/pages/1/preview');

			fixture.componentRef.setInput('entityId', '2');
			fixture.detectChanges();

			expect(component.previewUrl()).toBe('/api/pages/2/preview');
		});

		it('should update when collectionSlug changes', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component.previewUrl()).toBe('/api/pages/1/preview');

			fixture.componentRef.setInput('collectionSlug', 'articles');
			fixture.detectChanges();

			expect(component.previewUrl()).toBe('/api/articles/1/preview');
		});

		it('should transition from null to valid URL when data becomes available', () => {
			createComponent({
				preview: '/posts/{slug}',
				documentData: {},
				collectionSlug: 'posts',
			});

			expect(component.previewUrl()).toBeNull();

			fixture.componentRef.setInput('documentData', { slug: 'new-post' });
			fixture.detectChanges();

			expect(component.previewUrl()).toBe('/posts/new-post');
		});
	});

	// ---------------------------------------------------------------
	// Component creation
	// ---------------------------------------------------------------
	describe('component creation', () => {
		it('should create the component successfully', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(component).toBeTruthy();
		});

		it('should expose deviceSize as a writable signal', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(typeof component.deviceSize).toBe('function');
			expect(typeof component.deviceSize.set).toBe('function');
		});

		it('should expose previewUrl as a computed signal', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(typeof component.previewUrl).toBe('function');
			// Computed signals do not have a .set method
			expect(getPrivateMember<undefined>(component.previewUrl, 'set')).toBeUndefined();
		});

		it('should expose iframeWidth as a computed signal', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(typeof component.iframeWidth).toBe('function');
			expect(getPrivateMember<undefined>(component.iframeWidth, 'set')).toBeUndefined();
		});
	});

	// ---------------------------------------------------------------
	// Destroy handler for message listener
	// ---------------------------------------------------------------
	describe('destroy cleanup', () => {
		it('should register a destroy callback for message listener removal', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			expect(addEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));

			// Trigger destroy
			fixture.destroy();

			expect(removeEventListenerSpy).toHaveBeenCalledWith('message', expect.any(Function));
		});

		it('should clear debounce timer on destroy', () => {
			createComponent({
				preview: true,
				documentData: {},
				collectionSlug: 'pages',
				entityId: '1',
			});

			// Set a debounce timer manually to simulate pending timer
			const timerId = window.setTimeout(() => {
				// no-op
			}, 10000);
			(component as unknown as Record<string, unknown>)['debounceTimer'] = timerId;

			fixture.destroy();

			// After destroy, the debounceTimer should be cleared to undefined
			expect(getPrivateMember<number | undefined>(component, 'debounceTimer')).toBeUndefined();
		});
	});
});
