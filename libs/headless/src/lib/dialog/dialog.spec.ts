import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { A11yModule } from '@angular/cdk/a11y';
import { OverlayModule } from '@angular/cdk/overlay';
import { HdlDialog } from './dialog.component';
import { HdlDialogTitle } from './dialog-title.component';
import { HdlDialogDescription } from './dialog-description.component';
import { HdlDialogService } from './dialog.service';

@Component({
	selector: 'hdl-test-host',
	imports: [HdlDialog, HdlDialogTitle, HdlDialogDescription],
	template: `
		<hdl-dialog>
			<hdl-dialog-title>Test Title</hdl-dialog-title>
			<hdl-dialog-description>Test Description</hdl-dialog-description>
			<p>Dialog content</p>
		</hdl-dialog>
	`,
})
class TestHost {}

@Component({
	selector: 'hdl-test-host-no-labels',
	imports: [HdlDialog],
	template: `
		<hdl-dialog>
			<p>No title or description</p>
		</hdl-dialog>
	`,
})
class TestHostNoLabels {}

@Component({
	selector: 'hdl-test-overlay-dialog',
	imports: [HdlDialog],
	template: `
		<hdl-dialog>
			<p>Overlay dialog content</p>
		</hdl-dialog>
	`,
})
class TestOverlayDialog {}

describe('HdlDialog', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHost, TestHostNoLabels],
		}).compileComponents();
	});

	it('should have role="dialog"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('role')).toBe('dialog');
		expect(dialog.getAttribute('data-slot')).toBe('dialog');
		expect(dialog.getAttribute('data-state')).toBe('open');
	});

	it('should have aria-modal="true"', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});

	it('should register title for aria-labelledby', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		const titleId = fixture.nativeElement.querySelector('hdl-dialog-title').getAttribute('id');
		expect(titleId).toBeTruthy();
		expect(dialog.getAttribute('aria-labelledby')).toBe(titleId);
	});

	it('should register description for aria-describedby', async () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		const descId = fixture.nativeElement.querySelector('hdl-dialog-description').getAttribute('id');
		expect(descId).toBeTruthy();
		expect(dialog.getAttribute('aria-describedby')).toBe(descId);
	});

	it('should have null aria-labelledby when no title is provided', () => {
		const fixture = TestBed.createComponent(TestHostNoLabels);
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('aria-labelledby')).toBeNull();
	});

	it('should have null aria-describedby when no description is provided', () => {
		const fixture = TestBed.createComponent(TestHostNoLabels);
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('aria-describedby')).toBeNull();
	});

	it('should render projected content', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Dialog content');
	});

	it('should have no inline styles on the host', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const dialog = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('style')).toBeFalsy();
	});

	it('should have CdkTrapFocus applied as a host directive', () => {
		const fixture = TestBed.createComponent(TestHost);
		fixture.detectChanges();
		const dialogDebug = fixture.debugElement.query(
			(de) => de.nativeElement.tagName === 'HDL-DIALOG',
		);
		const dialog = dialogDebug.componentInstance as HdlDialog;
		expect(dialog).toBeTruthy();
		// The host element itself has the focus trap (via hostDirective), not a child div
		const childDiv = fixture.nativeElement.querySelector('hdl-dialog > div[cdktrapfocus]');
		expect(childDiv).toBeNull();
	});
});

@Component({
	selector: 'hdl-test-host-conditional',
	imports: [HdlDialog, HdlDialogTitle, HdlDialogDescription],
	template: `
		<hdl-dialog>
			@if (showTitle()) {
				<hdl-dialog-title>Removable Title</hdl-dialog-title>
			}
			@if (showDescription()) {
				<hdl-dialog-description>Removable Description</hdl-dialog-description>
			}
			<p>Dialog content</p>
		</hdl-dialog>
	`,
})
class TestHostConditional {
	readonly showTitle = signal(true);
	readonly showDescription = signal(true);
}

describe('HdlDialogTitle', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostConditional],
		}).compileComponents();
	});

	it('should clear aria-labelledby on the real dialog when title is destroyed', async () => {
		const fixture = TestBed.createComponent(TestHostConditional);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const dialog: HTMLElement = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('aria-labelledby')).toBeTruthy();

		fixture.componentInstance.showTitle.set(false);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(dialog.getAttribute('aria-labelledby')).toBeNull();
	});
});

describe('HdlDialogDescription', () => {
	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [TestHostConditional],
		}).compileComponents();
	});

	it('should clear aria-describedby on the real dialog when description is destroyed', async () => {
		const fixture = TestBed.createComponent(TestHostConditional);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const dialog: HTMLElement = fixture.nativeElement.querySelector('hdl-dialog');
		expect(dialog.getAttribute('aria-describedby')).toBeTruthy();

		fixture.componentInstance.showDescription.set(false);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(dialog.getAttribute('aria-describedby')).toBeNull();
	});
});

describe('HdlDialogService', () => {
	let service: HdlDialogService;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverlayModule, A11yModule, TestOverlayDialog],
			providers: [HdlDialogService],
		}).compileComponents();

		service = TestBed.inject(HdlDialogService);
	});

	afterEach(() => {
		service.closeAll();
		const overlayContainer = document.querySelector('.cdk-overlay-container');
		if (overlayContainer) {
			overlayContainer.replaceChildren();
		}
	});

	it('should emit afterClosed and remove from tracking when overlay detaches externally', () => {
		const ref = service.open(TestOverlayDialog);
		const closed = vi.fn();
		ref.afterClosed.subscribe(() => closed());

		expect(document.querySelectorAll('.cdk-overlay-pane')).toHaveLength(1);

		// Access the overlayRef to simulate external disposal (e.g., Angular route teardown)
		// This bypasses ref.close(), which is exactly the leak scenario
		(ref as any).overlayRef.dispose();

		// afterClosed should still fire so the service cleans up its tracking array
		expect(closed).toHaveBeenCalled();
	});

	it('should close every open dialog when closeAll is called', () => {
		const firstRef = service.open(TestOverlayDialog);
		const secondRef = service.open(TestOverlayDialog);
		const closed = vi.fn();

		firstRef.afterClosed.subscribe(() => closed('first'));
		secondRef.afterClosed.subscribe(() => closed('second'));

		expect(document.querySelectorAll('.hdl-dialog-panel')).toHaveLength(2);
		expect(document.querySelectorAll('.hdl-dialog-backdrop')).toHaveLength(2);
		expect(document.querySelectorAll('.cdk-overlay-pane')).toHaveLength(2);

		service.closeAll();

		expect(closed).toHaveBeenCalledTimes(2);
		expect(document.querySelectorAll('.cdk-overlay-pane')).toHaveLength(0);
	});
});
