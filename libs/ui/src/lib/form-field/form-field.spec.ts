import { ComponentFixture, TestBed } from '@angular/core/testing';
import { McmsFormField } from './form-field.component';

describe('McmsFormField', () => {
	let component: McmsFormField;
	let fixture: ComponentFixture<McmsFormField>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [McmsFormField],
		}).compileComponents();

		fixture = TestBed.createComponent(McmsFormField);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('id', 'test-field');
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
