import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField } from './form-field';

describe('FormField', () => {
	let component: FormField;
	let fixture: ComponentFixture<FormField>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FormField],
		}).compileComponents();

		fixture = TestBed.createComponent(FormField);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
