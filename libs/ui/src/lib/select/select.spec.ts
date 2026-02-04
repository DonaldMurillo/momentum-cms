import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Select } from './select.component';

describe('Select', () => {
	let component: Select;
	let fixture: ComponentFixture<Select>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Select],
		}).compileComponents();

		fixture = TestBed.createComponent(Select);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
