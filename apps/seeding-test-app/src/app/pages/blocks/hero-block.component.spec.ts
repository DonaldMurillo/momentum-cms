import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HeroBlockComponent } from './hero-block.component';

describe('HeroBlockComponent', () => {
	let component: HeroBlockComponent;
	let fixture: ComponentFixture<HeroBlockComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [HeroBlockComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(HeroBlockComponent);
		component = fixture.componentInstance;
	});

	it('should create', () => {
		fixture.componentRef.setInput('data', { heading: 'Test' });
		fixture.detectChanges();
		expect(component).toBeTruthy();
	});

	it('should render heading', () => {
		fixture.componentRef.setInput('data', { heading: 'Welcome Home' });
		fixture.detectChanges();

		const h1 = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hero-heading"]');
		expect(h1?.textContent).toContain('Welcome Home');
	});

	it('should render subheading when present', () => {
		fixture.componentRef.setInput('data', {
			heading: 'Title',
			subheading: 'A great subtitle',
		});
		fixture.detectChanges();

		const sub = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="hero-subheading"]',
		);
		expect(sub?.textContent).toContain('A great subtitle');
	});

	it('should not render subheading when empty', () => {
		fixture.componentRef.setInput('data', { heading: 'Title', subheading: '' });
		fixture.detectChanges();

		const sub = (fixture.nativeElement as HTMLElement).querySelector(
			'[data-testid="hero-subheading"]',
		);
		expect(sub).toBeNull();
	});

	it('should render CTA button when ctaText is present', () => {
		fixture.componentRef.setInput('data', {
			heading: 'Title',
			ctaText: 'Get Started',
			ctaLink: '/signup',
		});
		fixture.detectChanges();

		const cta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hero-cta"]');
		expect(cta?.textContent).toContain('Get Started');
		expect(cta?.getAttribute('href')).toBe('/signup');
	});

	it('should not render CTA when ctaText is empty', () => {
		fixture.componentRef.setInput('data', { heading: 'Title' });
		fixture.detectChanges();

		const cta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hero-cta"]');
		expect(cta).toBeNull();
	});

	it('should use # as fallback href when ctaLink is missing', () => {
		fixture.componentRef.setInput('data', {
			heading: 'Title',
			ctaText: 'Click Me',
		});
		fixture.detectChanges();

		const cta = (fixture.nativeElement as HTMLElement).querySelector('[data-testid="hero-cta"]');
		expect(cta?.getAttribute('href')).toBe('#');
	});
});
