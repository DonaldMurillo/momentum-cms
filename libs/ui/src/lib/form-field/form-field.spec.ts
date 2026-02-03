import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField } from './form-field.component';

describe('FormField', () => {
	let component: FormField;
	let fixture: ComponentFixture<FormField>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [FormField],
		}).compileComponents();

		fixture = TestBed.createComponent(FormField);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('id', 'test-field');
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
