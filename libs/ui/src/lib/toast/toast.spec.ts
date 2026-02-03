import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ToastService } from './toast.service';
import { ToastComponent } from './toast.component';
import { ToastContainer } from './toast-container.component';
import { ToastTitle } from './toast-title.component';
import { ToastDescription } from './toast-description.component';
import type { Toast } from './toast.types';

describe('ToastService', () => {
	let service: ToastService;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [ToastService],
		});
		service = TestBed.inject(ToastService);
	});

	afterEach(() => {
		service.dismissAll();
	});

	it('should create', () => {
		expect(service).toBeTruthy();
	});

	it('should show a toast', () => {
		const id = service.show('Test Title', 'Test Description');

		expect(id).toBeTruthy();
		expect(service.toasts().length).toBe(1);
		expect(service.toasts()[0].title).toBe('Test Title');
		expect(service.toasts()[0].description).toBe('Test Description');
	});

	it('should show success toast', () => {
		service.success('Success!', 'It worked');

		expect(service.toasts()[0].variant).toBe('success');
	});

	it('should show error toast', () => {
		service.error('Error!', 'Something went wrong');

		expect(service.toasts()[0].variant).toBe('destructive');
	});

	it('should show warning toast', () => {
		service.warning('Warning!', 'Be careful');

		expect(service.toasts()[0].variant).toBe('warning');
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
		service.show('Test 3');

		expect(service.toasts().length).toBe(3);

		service.dismissAll();

		expect(service.toasts().length).toBe(0);
	});

	it('should respect max toasts limit', () => {
		service.setMaxToasts(3);

		service.show('Test 1');
		service.show('Test 2');
		service.show('Test 3');
		service.show('Test 4');
		service.show('Test 5');

		expect(service.toasts().length).toBe(3);
		expect(service.toasts()[0].title).toBe('Test 3');
		expect(service.toasts()[2].title).toBe('Test 5');
	});

	it('should set position', () => {
		expect(service.position()).toBe('bottom-right');

		service.setPosition('top-left');

		expect(service.position()).toBe('top-left');
	});

	it('should include action in toast', () => {
		const onClick = vi.fn();
		service.show('Test', undefined, {
			action: { label: 'Undo', onClick },
		});

		expect(service.toasts()[0].action).toBeTruthy();
		expect(service.toasts()[0].action?.label).toBe('Undo');
	});
});

describe('ToastContainer', () => {
	let fixture: ComponentFixture<ToastContainer>;
	let service: ToastService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToastContainer],
			providers: [ToastService],
		}).compileComponents();

		service = TestBed.inject(ToastService);
		fixture = TestBed.createComponent(ToastContainer);
		fixture.detectChanges();
	});

	afterEach(() => {
		service.dismissAll();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have aria-live="polite"', () => {
		expect(fixture.nativeElement.getAttribute('aria-live')).toBe('polite');
	});

	it('should render toasts', () => {
		service.show('Test Toast');
		fixture.detectChanges();

		const toast = fixture.nativeElement.querySelector('mcms-toast');
		expect(toast).toBeTruthy();
	});

	it('should apply position class', () => {
		service.setPosition('top-left');
		fixture.detectChanges();

		expect(fixture.nativeElement.classList.contains('top-left')).toBe(true);
	});
});

describe('ToastComponent', () => {
	let fixture: ComponentFixture<ToastComponent>;

	const mockToast: Toast = {
		id: 'test-1',
		title: 'Test Title',
		description: 'Test Description',
		variant: 'default',
		duration: 5000,
		dismissible: true,
		createdAt: Date.now(),
	};

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToastComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(ToastComponent);
		fixture.componentRef.setInput('toast', mockToast);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="status"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('status');
	});

	it('should display title', () => {
		const title = fixture.nativeElement.querySelector('.toast-title');
		expect(title?.textContent).toBe('Test Title');
	});

	it('should display description', () => {
		const description = fixture.nativeElement.querySelector('.toast-description');
		expect(description?.textContent).toBe('Test Description');
	});

	it('should show close button when dismissible', () => {
		const closeButton = fixture.nativeElement.querySelector('.toast-close');
		expect(closeButton).toBeTruthy();
	});

	it('should hide close button when not dismissible', () => {
		fixture.componentRef.setInput('toast', { ...mockToast, dismissible: false });
		fixture.detectChanges();

		const closeButton = fixture.nativeElement.querySelector('.toast-close');
		expect(closeButton).toBeNull();
	});

	it('should emit dismissed when close button clicked', () => {
		const dismissedSpy = vi.fn();
		fixture.componentInstance.dismissed.subscribe(dismissedSpy);

		const closeButton = fixture.nativeElement.querySelector('.toast-close');
		closeButton.click();

		expect(dismissedSpy).toHaveBeenCalled();
	});

	it('should show action button when action provided', () => {
		const onClick = vi.fn();
		fixture.componentRef.setInput('toast', {
			...mockToast,
			action: { label: 'Undo', onClick },
		});
		fixture.detectChanges();

		const actionButton = fixture.nativeElement.querySelector('.toast-action');
		expect(actionButton).toBeTruthy();
		expect(actionButton?.textContent?.trim()).toBe('Undo');
	});

	it('should call action onClick and dismiss when action clicked', () => {
		const onClick = vi.fn();
		const dismissedSpy = vi.fn();
		fixture.componentInstance.dismissed.subscribe(dismissedSpy);
		fixture.componentRef.setInput('toast', {
			...mockToast,
			action: { label: 'Undo', onClick },
		});
		fixture.detectChanges();

		const actionButton = fixture.nativeElement.querySelector('.toast-action');
		actionButton.click();

		expect(onClick).toHaveBeenCalled();
		expect(dismissedSpy).toHaveBeenCalled();
	});

	it('should apply variant styles', () => {
		const variants = ['default', 'destructive', 'success', 'warning'] as const;

		for (const variant of variants) {
			fixture.componentRef.setInput('toast', { ...mockToast, variant });
			fixture.detectChanges();

			const style = fixture.nativeElement.style;
			expect(style.getPropertyValue('--toast-bg')).toBeTruthy();
			expect(style.getPropertyValue('--toast-border')).toBeTruthy();
			expect(style.getPropertyValue('--toast-color')).toBeTruthy();
		}
	});
});

describe('ToastTitle', () => {
	let fixture: ComponentFixture<ToastTitle>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToastTitle],
		}).compileComponents();

		fixture = TestBed.createComponent(ToastTitle);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('ToastDescription', () => {
	let fixture: ComponentFixture<ToastDescription>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ToastDescription],
		}).compileComponents();

		fixture = TestBed.createComponent(ToastDescription);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});
