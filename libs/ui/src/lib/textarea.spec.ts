import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Textarea } from './textarea';

describe('Textarea', () => {
	let component: Textarea;
	let fixture: ComponentFixture<Textarea>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Textarea],
		}).compileComponents();

		fixture = TestBed.createComponent(Textarea);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
