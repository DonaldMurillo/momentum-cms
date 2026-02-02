import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Label } from './label';

describe('Label', () => {
	let component: Label;
	let fixture: ComponentFixture<Label>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Label],
		}).compileComponents();

		fixture = TestBed.createComponent(Label);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
