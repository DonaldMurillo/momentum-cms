import { TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { ConfirmationDialogComponent } from './confirmation-dialog.component';
import { ConfirmationService } from './confirmation.service';
import { DialogService } from '../dialog/dialog.service';

describe('ConfirmationService', () => {
	let service: ConfirmationService;
	let dialogService: DialogService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, A11yModule],
			providers: [ConfirmationService, DialogService],
		}).compileComponents();

		service = TestBed.inject(ConfirmationService);
		dialogService = TestBed.inject(DialogService);
	});

	afterEach(() => {
		dialogService.closeAll();
		const overlayContainer = document.querySelector('.cdk-overlay-container');
		if (overlayContainer) {
			while (overlayContainer.firstChild) {
				overlayContainer.removeChild(overlayContainer.firstChild);
			}
		}
	});

	it('should create', () => {
		expect(service).toBeTruthy();
	});

	it('should have confirm method', () => {
		expect(typeof service.confirm).toBe('function');
	});

	it('should have delete convenience method', () => {
		expect(typeof service.delete).toBe('function');
	});

	it('should have discardChanges convenience method', () => {
		expect(typeof service.discardChanges).toBe('function');
	});

	it('should have logout convenience method', () => {
		expect(typeof service.logout).toBe('function');
	});

	it('should return a promise from confirm', () => {
		const result = service.confirm({ title: 'Test' });
		expect(result).toBeInstanceOf(Promise);
		// Clean up by closing
		dialogService.closeAll();
	});
});

describe('ConfirmationDialogComponent', () => {
	it('should exist', () => {
		expect(ConfirmationDialogComponent).toBeTruthy();
	});
});
