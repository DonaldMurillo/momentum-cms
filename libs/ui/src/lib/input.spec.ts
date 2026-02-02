import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Input } from './input';

describe('Input', () => {
	let component: Input;
	let fixture: ComponentFixture<Input>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Input],
		}).compileComponents();

		fixture = TestBed.createComponent(Input);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
