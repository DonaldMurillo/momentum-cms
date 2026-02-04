import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RadioGroup } from './radio-group.component';

describe('RadioGroup', () => {
	let component: RadioGroup;
	let fixture: ComponentFixture<RadioGroup>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [RadioGroup],
		}).compileComponents();

		fixture = TestBed.createComponent(RadioGroup);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
