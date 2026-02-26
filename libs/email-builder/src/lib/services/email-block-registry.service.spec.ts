import { TestBed } from '@angular/core/testing';
import {
	EmailBlockRegistryService,
	DEFAULT_EMAIL_BLOCK_DEFINITIONS,
	provideEmailBlocks,
} from './email-block-registry.service';
import type { EmailBlockDefinition } from '@momentumcms/email';

describe('EmailBlockRegistryService', () => {
	describe('with default blocks', () => {
		let service: EmailBlockRegistryService;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [EmailBlockRegistryService, provideEmailBlocks(DEFAULT_EMAIL_BLOCK_DEFINITIONS)],
			});
			service = TestBed.inject(EmailBlockRegistryService);
		});

		it('should have all default block definitions', () => {
			expect(service.definitions.length).toBe(DEFAULT_EMAIL_BLOCK_DEFINITIONS.length);
		});

		it('should look up blocks by slug', () => {
			const textBlock = service.get('text');
			expect(textBlock).toBeDefined();
			expect(textBlock?.label).toBe('Text');
		});

		it('should report existence via has()', () => {
			expect(service.has('text')).toBe(true);
			expect(service.has('header')).toBe(true);
			expect(service.has('nonexistent')).toBe(false);
		});

		it('should return undefined for unknown slugs', () => {
			expect(service.get('unknown')).toBeUndefined();
		});

		it('should include all 8 built-in block types', () => {
			const slugs = service.definitions.map((d) => d.slug);
			expect(slugs).toContain('header');
			expect(slugs).toContain('text');
			expect(slugs).toContain('button');
			expect(slugs).toContain('image');
			expect(slugs).toContain('divider');
			expect(slugs).toContain('spacer');
			expect(slugs).toContain('columns');
			expect(slugs).toContain('footer');
		});
	});

	describe('with custom blocks', () => {
		const customBlock: EmailBlockDefinition = {
			slug: 'custom-hero',
			label: 'Custom Hero',
			fields: [{ name: 'title', label: 'Title', type: 'text', required: true }],
			defaultData: { title: 'Hero Title' },
		};

		let service: EmailBlockRegistryService;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [
					EmailBlockRegistryService,
					provideEmailBlocks(DEFAULT_EMAIL_BLOCK_DEFINITIONS),
					provideEmailBlocks([customBlock]),
				],
			});
			service = TestBed.inject(EmailBlockRegistryService);
		});

		it('should merge multiple provider sets', () => {
			expect(service.definitions.length).toBe(DEFAULT_EMAIL_BLOCK_DEFINITIONS.length + 1);
		});

		it('should find custom block by slug', () => {
			const found = service.get('custom-hero');
			expect(found).toBeDefined();
			expect(found?.label).toBe('Custom Hero');
		});

		it('should still find default blocks', () => {
			expect(service.has('text')).toBe(true);
		});
	});

	describe('with no providers', () => {
		let service: EmailBlockRegistryService;

		beforeEach(() => {
			TestBed.configureTestingModule({
				providers: [EmailBlockRegistryService],
			});
			service = TestBed.inject(EmailBlockRegistryService);
		});

		it('should have empty definitions when no blocks provided', () => {
			expect(service.definitions).toEqual([]);
		});
	});
});

describe('DEFAULT_EMAIL_BLOCK_DEFINITIONS', () => {
	it('should have defaultData for every block', () => {
		for (const def of DEFAULT_EMAIL_BLOCK_DEFINITIONS) {
			expect(def.defaultData).toBeDefined();
		}
	});

	it('should have fields for every block', () => {
		for (const def of DEFAULT_EMAIL_BLOCK_DEFINITIONS) {
			expect(def.fields.length).toBeGreaterThan(0);
		}
	});

	it('should have unique slugs', () => {
		const slugs = DEFAULT_EMAIL_BLOCK_DEFINITIONS.map((d) => d.slug);
		expect(new Set(slugs).size).toBe(slugs.length);
	});
});
