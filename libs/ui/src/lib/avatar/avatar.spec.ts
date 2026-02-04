import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Avatar } from './avatar.component';
import { AvatarImage } from './avatar-image.component';
import { AvatarFallback } from './avatar-fallback.component';

@Component({
	imports: [Avatar, AvatarImage, AvatarFallback],
	template: `
		<mcms-avatar [size]="size">
			<mcms-avatar-image [src]="imageSrc" alt="Test" (loadError)="onError()" />
			<mcms-avatar-fallback [delayMs]="delayMs">{{ fallbackText }}</mcms-avatar-fallback>
		</mcms-avatar>
	`,
})
class _TestHostComponent {
	size: 'sm' | 'md' | 'lg' = 'md';
	imageSrc = 'test.jpg';
	fallbackText = 'JD';
	delayMs = 0;
	errorEmitted = false;

	onError(): void {
		this.errorEmitted = true;
	}
}

describe('Avatar', () => {
	let fixture: ComponentFixture<Avatar>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Avatar],
		}).compileComponents();

		fixture = TestBed.createComponent(Avatar);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have default size of md', () => {
		expect(fixture.componentInstance.size()).toBe('md');
	});

	it('should be rounded-full', () => {
		expect(fixture.nativeElement.classList.contains('rounded-full')).toBe(true);
	});

	it('should have overflow-hidden', () => {
		expect(fixture.nativeElement.classList.contains('overflow-hidden')).toBe(true);
	});

	it('should apply size classes', () => {
		expect(fixture.nativeElement.classList.contains('h-10')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-10')).toBe(true);

		fixture.componentRef.setInput('size', 'sm');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('h-8')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-8')).toBe(true);

		fixture.componentRef.setInput('size', 'lg');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('h-12')).toBe(true);
		expect(fixture.nativeElement.classList.contains('w-12')).toBe(true);
	});
});

describe('AvatarImage', () => {
	let fixture: ComponentFixture<AvatarImage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AvatarImage],
		}).compileComponents();

		fixture = TestBed.createComponent(AvatarImage);
		fixture.componentRef.setInput('src', 'test.jpg');
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should render img element', () => {
		const img = fixture.nativeElement.querySelector('img');
		expect(img).toBeTruthy();
	});

	it('should set src attribute', () => {
		const img = fixture.nativeElement.querySelector('img');
		expect(img.getAttribute('src')).toBe('test.jpg');
	});

	it('should set alt attribute', () => {
		fixture.componentRef.setInput('alt', 'Test image');
		fixture.detectChanges();
		const img = fixture.nativeElement.querySelector('img');
		expect(img.getAttribute('alt')).toBe('Test image');
	});
});

describe('AvatarFallback', () => {
	let fixture: ComponentFixture<AvatarFallback>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [AvatarFallback],
		}).compileComponents();

		fixture = TestBed.createComponent(AvatarFallback);
		fixture.componentRef.setInput('delayMs', 0);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have default delay of 600ms', async () => {
		const newFixture = TestBed.createComponent(AvatarFallback);
		await newFixture.whenStable();
		expect(newFixture.componentInstance.delayMs()).toBe(600);
	});

	it('should have bg-muted class', () => {
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('bg-muted')).toBe(true);
	});

	it('should be flex centered', () => {
		fixture.detectChanges();
		expect(fixture.nativeElement.classList.contains('items-center')).toBe(true);
		expect(fixture.nativeElement.classList.contains('justify-center')).toBe(true);
	});
});

describe('Avatar Integration', () => {
	let fixture: ComponentFixture<_TestHostComponent>;
	let host: _TestHostComponent;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [_TestHostComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(_TestHostComponent);
		host = fixture.componentInstance;
		// Set initial values before first detectChanges
		host.delayMs = 0;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('should show fallback when delay is 0 and image not loaded', async () => {
		fixture.detectChanges();

		const fallback = fixture.nativeElement.querySelector('mcms-avatar-fallback');
		// Fallback should be visible initially (image not loaded yet)
		expect(fallback.classList.contains('hidden')).toBe(false);
	});

	it('should apply size classes to avatar', () => {
		const avatar = fixture.nativeElement.querySelector('mcms-avatar');
		// Default size is md
		expect(avatar.classList.contains('h-10')).toBe(true);
		expect(avatar.classList.contains('w-10')).toBe(true);
	});
});
