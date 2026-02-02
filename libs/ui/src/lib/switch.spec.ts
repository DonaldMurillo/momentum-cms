import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Switch } from './switch';

describe('Switch', () => {
	let component: Switch;
	let fixture: ComponentFixture<Switch>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Switch],
		}).compileComponents();

		fixture = TestBed.createComponent(Switch);
		component = fixture.componentInstance;
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
