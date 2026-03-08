import { TestBed } from '@angular/core/testing';
import { Component } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { HdlToastService } from './toast.service';
import { HdlToastContainer } from './toast-container.component';

@Component({
	imports: [HdlToastContainer],
	template: `<hdl-toast-container />`,
})
class ToastHost {}

describe('HdlToastService', () => {
	let service: HdlToastService;
	let announceArgs: [string, string][];

	beforeEach(() => {
		announceArgs = [];
		TestBed.configureTestingModule({
			providers: [
				{
					provide: LiveAnnouncer,
					useValue: {
						announce: (message: string, politeness: string) => {
							announceArgs.push([message, politeness]);
							return Promise.resolve();
						},
					},
				},
			],
		});
		service = TestBed.inject(HdlToastService);
	});

	afterEach(() => {
		service.dismissAll();
	});

	it('should add a toast with correct properties', () => {
		service.show('Test Title', 'Test Description');
		const toast = service.toasts()[0];
		expect(toast.title).toBe('Test Title');
		expect(toast.description).toBe('Test Description');
		expect(toast.variant).toBe('default');
		expect(toast.dismissible).toBe(true);
		expect(toast.duration).toBe(5000);
		expect(toast.id).toMatch(/^hdl-toast-/);
	});

	it('should return a unique id from show()', () => {
		const id1 = service.show('Toast 1');
		const id2 = service.show('Toast 2');
		expect(id1).not.toBe(id2);
	});

	it('should dismiss a toast by id', () => {
		const id = service.show('Test');
		expect(service.toasts().length).toBe(1);
		service.dismiss(id);
		expect(service.toasts().length).toBe(0);
	});

	it('should dismiss all toasts', () => {
		service.show('Test 1');
		service.show('Test 2');
		expect(service.toasts().length).toBe(2);
		service.dismissAll();
		expect(service.toasts().length).toBe(0);
	});

	it('should show success toast with variant "success"', () => {
		service.success('Success!');
		expect(service.toasts()[0].variant).toBe('success');
	});

	it('should show error toast with variant "destructive"', () => {
		service.error('Error!');
		expect(service.toasts()[0].variant).toBe('destructive');
	});

	it('should show warning toast with variant "warning"', () => {
		service.warning('Warning!');
		expect(service.toasts()[0].variant).toBe('warning');
	});

	it('should evict oldest toast when exceeding max', () => {
		service.setMaxToasts(2);
		service.show('First');
		service.show('Second');
		service.show('Third');
		const toasts = service.toasts();
		expect(toasts.length).toBe(2);
		expect(toasts[0].title).toBe('Second');
		expect(toasts[1].title).toBe('Third');
	});

	it('should set position', () => {
		service.setPosition('top-center');
		expect(service.position()).toBe('top-center');
	});

	it('should announce toast with polite politeness by default', () => {
		service.show('Hello');
		expect(announceArgs.length).toBe(1);
		expect(announceArgs[0][0]).toBe('Hello');
		expect(announceArgs[0][1]).toBe('polite');
	});

	it('should announce destructive toast with assertive politeness', () => {
		service.error('Critical Error');
		expect(announceArgs.length).toBe(1);
		expect(announceArgs[0][0]).toBe('Critical Error');
		expect(announceArgs[0][1]).toBe('assertive');
	});

	it('should include description in announcement', () => {
		service.show('Title', 'More details');
		expect(announceArgs[0][0]).toBe('Title. More details');
	});

	it('should auto-dismiss toast after duration', () => {
		vi.useFakeTimers();
		service.show('Auto', undefined, { duration: 1000 });
		expect(service.toasts().length).toBe(1);
		vi.advanceTimersByTime(1000);
		expect(service.toasts().length).toBe(0);
		vi.useRealTimers();
	});

	it('should not auto-dismiss when duration is 0', () => {
		vi.useFakeTimers();
		service.show('Sticky', undefined, { duration: 0 });
		expect(service.toasts().length).toBe(1);
		vi.advanceTimersByTime(10000);
		expect(service.toasts().length).toBe(1);
		vi.useRealTimers();
	});

	it('should accept custom config options', () => {
		const onClick = vi.fn();
		const action = { label: 'Undo', onClick };
		service.show('Custom', 'Desc', {
			variant: 'warning',
			dismissible: false,
			duration: 3000,
			action,
		});
		const toast = service.toasts()[0];
		expect(toast.variant).toBe('warning');
		expect(toast.dismissible).toBe(false);
		expect(toast.duration).toBe(3000);
		expect(toast.action).toBe(action);
	});

	it('should expose styling contract attributes on toast container and toasts', async () => {
		const fixture = TestBed.createComponent(ToastHost);
		service.setPosition('top-center');
		service.success('Styled toast');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const container = fixture.nativeElement.querySelector('hdl-toast-container');
		const toast = fixture.nativeElement.querySelector('hdl-toast');

		expect(container.getAttribute('data-slot')).toBe('toast-container');
		expect(container.getAttribute('data-position')).toBe('top-center');
		expect(toast.getAttribute('data-slot')).toBe('toast');
		expect(toast.getAttribute('data-variant')).toBe('success');
		expect(toast.getAttribute('data-dismissible')).toBe('true');
	});

	it('should render toast title, description, and action content', async () => {
		const action = vi.fn();
		const fixture = TestBed.createComponent(ToastHost);
		service.show('Styled toast', 'With details', {
			action: { label: 'Undo', onClick: action },
		});
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const toast = fixture.nativeElement.querySelector('hdl-toast');
		const title = toast.querySelector('[data-slot="toast-title"]');
		const description = toast.querySelector('[data-slot="toast-description"]');
		const actionButton = toast.querySelector('[data-slot="toast-action"]');
		const dismissButton = toast.querySelector('[data-slot="toast-dismiss"]');

		expect(title?.textContent).toContain('Styled toast');
		expect(description?.textContent).toContain('With details');
		expect(actionButton?.textContent).toContain('Undo');
		expect(dismissButton?.textContent).toContain('Dismiss');

		actionButton.click();
		expect(action).toHaveBeenCalledTimes(1);
	});
});
