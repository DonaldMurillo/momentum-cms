import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import type { WorkflowConfig } from '@momentumcms/core';
import { StageFilterPills } from '../stage-filter-pills.component';

const workflow: WorkflowConfig = {
	stages: [
		{ id: 'draft', label: 'Draft', transitions: ['in-review'] },
		{ id: 'in-review', label: 'In Review', transitions: ['draft', 'approved'] },
		{ id: 'approved', label: 'Approved', transitions: [], publishesOnEnter: true },
	],
	initialStage: 'draft',
};

describe('StageFilterPills', () => {
	let fixture: ComponentFixture<StageFilterPills>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({ imports: [StageFilterPills] }).compileComponents();
		fixture = TestBed.createComponent(StageFilterPills);
		fixture.componentRef.setInput('workflow', workflow);
		fixture.detectChanges();
	});

	it('renders one pill per stage plus All', () => {
		const buttons = fixture.nativeElement.querySelectorAll('button');
		expect(buttons.length).toBe(4);
	});

	it('emits null when All is clicked', async () => {
		const spy = vi.fn();
		fixture.componentInstance.selectionChange.subscribe(spy);
		const allBtn = fixture.nativeElement.querySelector('[data-testid="stage-filter-all"]');
		allBtn?.click();
		expect(spy).toHaveBeenCalledWith(null);
	});

	it('emits stage id when a stage pill is clicked', () => {
		const spy = vi.fn();
		fixture.componentInstance.selectionChange.subscribe(spy);
		const inReviewBtn = fixture.nativeElement.querySelector(
			'[data-testid="stage-filter-in-review"]',
		);
		inReviewBtn?.click();
		expect(spy).toHaveBeenCalledWith('in-review');
	});

	it('marks the active pill with aria-pressed', () => {
		fixture.componentRef.setInput('value', 'in-review');
		fixture.detectChanges();
		const inReviewBtn = fixture.nativeElement.querySelector(
			'[data-testid="stage-filter-in-review"]',
		);
		expect(inReviewBtn?.getAttribute('aria-pressed')).toBe('true');
	});
});
