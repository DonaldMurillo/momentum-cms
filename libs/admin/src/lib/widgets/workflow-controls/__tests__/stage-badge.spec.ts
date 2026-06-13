import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach } from 'vitest';
import { StageBadge } from '../stage-badge.component';

describe('StageBadge', () => {
	let fixture: ComponentFixture<StageBadge>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [StageBadge] }).compileComponents();
		fixture = TestBed.createComponent(StageBadge);
	});

	it('renders the stage label', async () => {
		fixture.componentRef.setInput('stage', {
			id: 'draft',
			label: 'Draft',
			transitions: [],
			color: 'gray',
		});
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('Draft');
	});

	it('falls back to Unknown when no stage is provided', async () => {
		fixture.detectChanges();
		await fixture.whenStable();
		expect(fixture.nativeElement.textContent).toContain('Unknown');
	});

	it('maps stage colors to badge variants (rendered DOM)', async () => {
		fixture.componentRef.setInput('stage', {
			id: 'approved',
			label: 'Approved',
			transitions: [],
			color: 'green',
		});
		fixture.detectChanges();
		await fixture.whenStable();
		// Badge sets `data-tone="success"` on its host when variant === 'success'.
		// Asserting on the rendered attribute proves the binding actually
		// reaches the DOM — internal `variant()` could match while the
		// template binding is broken or omitted entirely.
		const badge = fixture.nativeElement.querySelector('mcms-badge');
		expect(badge).not.toBeNull();
		expect(badge?.getAttribute('data-tone')).toBe('success');
	});

	it('maps amber color to warning tone (rendered DOM)', async () => {
		fixture.componentRef.setInput('stage', {
			id: 'in-review',
			label: 'In Review',
			transitions: [],
			color: 'amber',
		});
		fixture.detectChanges();
		await fixture.whenStable();
		const badge = fixture.nativeElement.querySelector('mcms-badge');
		expect(badge?.getAttribute('data-tone')).toBe('warning');
	});

	it('maps red color to destructive tone (rendered DOM)', async () => {
		fixture.componentRef.setInput('stage', {
			id: 'blocked',
			label: 'Blocked',
			transitions: [],
			color: 'red',
		});
		fixture.detectChanges();
		await fixture.whenStable();
		const badge = fixture.nativeElement.querySelector('mcms-badge');
		expect(badge?.getAttribute('data-tone')).toBe('destructive');
	});

	it('renders the secondary variant (no tone) when color is missing', async () => {
		fixture.componentRef.setInput('stage', {
			id: 'limbo',
			label: 'Limbo',
			transitions: [],
		});
		fixture.detectChanges();
		await fixture.whenStable();
		const badge = fixture.nativeElement.querySelector('mcms-badge');
		// Assert the badge actually exists first — `undefined?.getAttribute()`
		// returns undefined which would NOT pass `.toBeNull()` (good), but
		// `badge?.getAttribute()` does, so a future selector rename
		// (`mcms-badge` → `mc-badge`) would silently green this test.
		expect(badge).not.toBeNull();
		// secondary variant maps to no tone — the data-tone attribute is
		// absent rather than 'secondary'. Asserting the absence proves
		// the variant isn't accidentally falling through to success/warning.
		expect((badge as Element).getAttribute('data-tone')).toBeNull();
	});
});
