import { TestBed } from '@angular/core/testing';
import { RouterModule } from '@angular/router';
import { App } from './app';

describe('App', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [App, RouterModule.forRoot([])],
		}).compileComponents();
	});

	it('should create the app', async () => {
		const fixture = TestBed.createComponent(App);
		await fixture.whenStable();
		expect(fixture.componentInstance).toBeTruthy();
	});
});
