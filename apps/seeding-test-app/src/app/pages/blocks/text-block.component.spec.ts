import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TextBlockComponent } from './text-block.component';

describe('TextBlockComponent', () => {
	let component: TextBlockComponent;
	let fixture: ComponentFixture<TextBlockComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TextBlockComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(TextBlockComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		fixture.componentRef.setInput('data', { body: 'Test' });
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should render body text', () => {
		fixture.componentRef.setInput('data', { body: 'This is the body text.' });
		fixture.detectChanges();

		const body = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="text-body"]');
		expect(body?.textContent).toContain('This is the body text.');
	});

	it('should render heading when present', () => {
		fixture.componentRef.setInput('data', {
			heading: 'Section Title',
			body: 'Body content',
		});
		fixture.detectChanges();

		const heading = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="text-heading"]',
		);
		expect(heading?.textContent).toContain('Section Title');
	});

	it('should not render heading when empty', () => {
		fixture.componentRef.setInput('data', { body: 'Just body' });
		fixture.detectChanges();

		const heading = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="text-heading"]',
		);
		expect(heading).toBeNull();
	});
});
