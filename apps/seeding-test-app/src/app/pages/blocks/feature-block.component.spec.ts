import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FeatureBlockComponent } from './feature-block.component';

describe('FeatureBlockComponent', () => {
	let component: FeatureBlockComponent;
	let fixture: ComponentFixture<FeatureBlockComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FeatureBlockComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(FeatureBlockComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		fixture.componentRef.setInput('data', { title: 'Test' });
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should render title', () => {
		fixture.componentRef.setInput('data', { title: 'Fast Performance' });
		fixture.detectChanges();

		const title = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="feature-title"]',
		);
		expect(title?.textContent).toContain('Fast Performance');
	});

	it('should render description when present', () => {
		fixture.componentRef.setInput('data', {
			title: 'Feature',
			description: 'This is a great feature.',
		});
		fixture.detectChanges();

		const desc = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="feature-description"]',
		);
		expect(desc?.textContent).toContain('This is a great feature.');
	});

	it('should not render description when empty', () => {
		fixture.componentRef.setInput('data', { title: 'Feature' });
		fixture.detectChanges();

		const desc = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="feature-description"]',
		);
		expect(desc).toBeNull();
	});

	it('should render icon when present', () => {
		fixture.componentRef.setInput('data', { title: 'Feature', icon: 'star' });
		fixture.detectChanges();

		const icon = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="feature-icon"]',
		);
		expect(icon?.textContent).toContain('star');
	});

	it('should not render icon when empty', () => {
		fixture.componentRef.setInput('data', { title: 'Feature' });
		fixture.detectChanges();

		const icon = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="feature-icon"]',
		);
		expect(icon).toBeNull();
	});
});
