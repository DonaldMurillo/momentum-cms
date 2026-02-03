import { Component, inject } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverlayModule } from '@angular/cdk/overlay';
import { A11yModule } from '@angular/cdk/a11y';
import { Dialog } from './dialog.component';
import { DialogHeader } from './dialog-header.component';
import { DialogTitle } from './dialog-title.component';
import { DialogDescription } from './dialog-description.component';
import { DialogContent } from './dialog-content.component';
import { DialogFooter } from './dialog-footer.component';
import { DialogClose } from './dialog-close.directive';
import { DialogRef } from './dialog-ref';
import { DialogService } from './dialog.service';
import { DIALOG_DATA } from './dialog.token';

@Component({
	selector: 'mcms-test-dialog',
	imports: [
		Dialog,
		DialogHeader,
		DialogTitle,
		DialogDescription,
		DialogContent,
		DialogFooter,
		DialogClose,
	],
	template: `
		<mcms-dialog>
			<mcms-dialog-header>
				<mcms-dialog-title>Test Dialog</mcms-dialog-title>
				<mcms-dialog-description>Test description</mcms-dialog-description>
			</mcms-dialog-header>
			<mcms-dialog-content>
				<p>Dialog content: {{ data?.message }}</p>
			</mcms-dialog-content>
			<mcms-dialog-footer>
				<button mcmsDialogClose>Cancel</button>
				<button [mcmsDialogClose]="'confirmed'">Confirm</button>
			</mcms-dialog-footer>
		</mcms-dialog>
	`,
})
class _TestDialogComponent {
	readonly data = inject(DIALOG_DATA, { optional: true }) as { message: string } | null;
	readonly dialogRef = inject(DialogRef<string>, { optional: true });
}

describe('DialogService', () => {
	let service: DialogService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, A11yModule],
			providers: [DialogService],
		}).compileComponents();

		service = TestBed.inject(DialogService);
	});

	afterEach(() => {
		service.closeAll();
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
});

describe('Dialog', () => {
	let fixture: ComponentFixture<Dialog>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [Dialog, A11yModule],
		}).compileComponents();

		fixture = TestBed.createComponent(Dialog);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have role="dialog"', () => {
		expect(fixture.nativeElement.getAttribute('role')).toBe('dialog');
	});

	it('should have aria-modal="true"', () => {
		expect(fixture.nativeElement.getAttribute('aria-modal')).toBe('true');
	});
});

describe('DialogTitle', () => {
	let fixture: ComponentFixture<DialogTitle>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogTitle],
		}).compileComponents();

		fixture = TestBed.createComponent(DialogTitle);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have unique id', () => {
		const id = fixture.nativeElement.getAttribute('id');
		expect(id).toMatch(/^mcms-dialog-title-\d+$/);
	});
});

describe('DialogDescription', () => {
	let fixture: ComponentFixture<DialogDescription>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogDescription],
		}).compileComponents();

		fixture = TestBed.createComponent(DialogDescription);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});

	it('should have unique id', () => {
		const id = fixture.nativeElement.getAttribute('id');
		expect(id).toMatch(/^mcms-dialog-desc-\d+$/);
	});
});

describe('DialogHeader', () => {
	let fixture: ComponentFixture<DialogHeader>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogHeader],
		}).compileComponents();

		fixture = TestBed.createComponent(DialogHeader);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('DialogContent', () => {
	let fixture: ComponentFixture<DialogContent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogContent],
		}).compileComponents();

		fixture = TestBed.createComponent(DialogContent);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});

describe('DialogFooter', () => {
	let fixture: ComponentFixture<DialogFooter>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [DialogFooter],
		}).compileComponents();

		fixture = TestBed.createComponent(DialogFooter);
		await fixture.whenStable();
	});

	it('should create', () => {
		expect(fixture.componentInstance).toBeTruthy();
	});
});
