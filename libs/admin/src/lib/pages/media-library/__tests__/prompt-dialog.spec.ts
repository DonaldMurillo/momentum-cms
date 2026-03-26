import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Subject } from 'rxjs';
import { DialogRef, DIALOG_DATA } from '@momentumcms/ui';
import {
	PromptDialog,
	SelectDialog,
	type PromptDialogData,
	type SelectDialogData,
} from '../prompt-dialog.component';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockDialogRef<T>() {
	return {
		close: vi.fn(),
		afterClosed: new Subject<T>().asObservable(),
	};
}

// ---------------------------------------------------------------------------
// PromptDialog
// ---------------------------------------------------------------------------

describe('PromptDialog', () => {
	let fixture: ComponentFixture<PromptDialog>;
	let component: PromptDialog;
	let dialogRef: ReturnType<typeof createMockDialogRef<string | undefined>>;

	const defaultData: PromptDialogData = {
		title: 'New Folder',
		label: 'Folder name',
		placeholder: 'Enter name',
		confirmText: 'Create',
	};

	beforeEach(async () => {
		dialogRef = createMockDialogRef<string | undefined>();

		await TestBed.configureTestingModule({
			imports: [PromptDialog],
			providers: [
				{ provide: DialogRef, useValue: dialogRef },
				{ provide: DIALOG_DATA, useValue: defaultData },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(PromptDialog);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should render the dialog with title and label', () => {
		const el: HTMLElement = fixture.nativeElement;
		expect(el.querySelector('h2')?.textContent).toContain('New Folder');
		expect(el.querySelector('label')?.textContent).toContain('Folder name');
	});

	it('should render input with placeholder', () => {
		const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
		expect(input.placeholder).toBe('Enter name');
	});

	it('should have aria-modal attribute on dialog', () => {
		const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
		expect(dialog).toBeTruthy();
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});

	it('should associate label with input via for/id', () => {
		const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
		const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
		expect(label.getAttribute('for')).toBe(input.id);
		expect(input.id).toBeTruthy();
	});

	it('should disable submit button when value is empty', () => {
		const buttons = fixture.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Create',
		) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(true);
	});

	it('should enable submit button when value is non-empty', () => {
		component.value.set('Campaign Assets');
		fixture.detectChanges();

		const buttons = fixture.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Create',
		) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(false);
	});

	it('should close with trimmed value on submit', () => {
		component.value.set('  My Folder  ');
		component.submit();
		expect(dialogRef.close).toHaveBeenCalledWith('My Folder');
	});

	it('should not close when submitting empty/whitespace value', () => {
		component.value.set('   ');
		component.submit();
		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('should close with undefined on cancel', () => {
		component.cancel();
		expect(dialogRef.close).toHaveBeenCalledWith(undefined);
	});

	it('should submit on Enter key when value is non-empty', () => {
		component.value.set('Test Folder');
		fixture.detectChanges();

		const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

		expect(dialogRef.close).toHaveBeenCalledWith('Test Folder');
	});

	it('should not submit on Enter key when value is empty', () => {
		const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('should cancel on Escape key', () => {
		const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

		expect(dialogRef.close).toHaveBeenCalledWith(undefined);
	});

	it('should use default confirmText when not provided', async () => {
		const dataWithoutConfirm: PromptDialogData = {
			title: 'Test',
			label: 'Name',
		};

		// Reset TestBed for a fresh configuration
		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [PromptDialog],
			providers: [
				{ provide: DialogRef, useValue: createMockDialogRef<string | undefined>() },
				{ provide: DIALOG_DATA, useValue: dataWithoutConfirm },
			],
		}).compileComponents();

		const fixture2 = TestBed.createComponent(PromptDialog);
		fixture2.detectChanges();

		const buttons = fixture2.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Create',
		) as HTMLButtonElement;
		expect(submitBtn).toBeTruthy();
	});

	it('should generate unique input IDs across instances', () => {
		const fixture2 = TestBed.createComponent(PromptDialog);
		fixture2.detectChanges();
		expect(component.inputId).not.toBe(fixture2.componentInstance.inputId);
	});
});

// ---------------------------------------------------------------------------
// SelectDialog
// ---------------------------------------------------------------------------

describe('SelectDialog', () => {
	let fixture: ComponentFixture<SelectDialog>;
	let component: SelectDialog;
	let dialogRef: ReturnType<typeof createMockDialogRef<string | undefined>>;

	const defaultData: SelectDialogData = {
		title: 'Move to Folder',
		label: 'Select folder',
		options: [
			{ id: 'folder-1', name: 'Photos' },
			{ id: 'folder-2', name: 'Archive' },
		],
		confirmText: 'Move',
	};

	beforeEach(async () => {
		dialogRef = createMockDialogRef<string | undefined>();

		await TestBed.configureTestingModule({
			imports: [SelectDialog],
			providers: [
				{ provide: DialogRef, useValue: dialogRef },
				{ provide: DIALOG_DATA, useValue: defaultData },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(SelectDialog);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should render the dialog with title and label', () => {
		const el: HTMLElement = fixture.nativeElement;
		expect(el.querySelector('h2')?.textContent).toContain('Move to Folder');
		expect(el.querySelector('label')?.textContent).toContain('Select folder');
	});

	it('should have aria-modal attribute on dialog', () => {
		const dialog = fixture.nativeElement.querySelector('[role="dialog"]');
		expect(dialog).toBeTruthy();
		expect(dialog.getAttribute('aria-modal')).toBe('true');
	});

	it('should associate label with select via for/id', () => {
		const label = fixture.nativeElement.querySelector('label') as HTMLLabelElement;
		const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
		expect(label.getAttribute('for')).toBe(select.id);
		expect(select.id).toBeTruthy();
	});

	it('should render all options plus a placeholder', () => {
		const options = fixture.nativeElement.querySelectorAll('option');
		expect(options.length).toBe(3); // "Select..." + 2 real options
		expect(options[0].textContent).toContain('Select...');
		expect(options[1].textContent).toContain('Photos');
		expect(options[2].textContent).toContain('Archive');
	});

	it('should disable submit button when no option selected', () => {
		const buttons = fixture.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Move',
		) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(true);
	});

	it('should enable submit button after selecting an option', () => {
		component.selectedId.set('folder-1');
		fixture.detectChanges();

		const buttons = fixture.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Move',
		) as HTMLButtonElement;
		expect(submitBtn.disabled).toBe(false);
	});

	it('should close with selected id on submit', () => {
		component.selectedId.set('folder-2');
		component.submit();
		expect(dialogRef.close).toHaveBeenCalledWith('folder-2');
	});

	it('should not close when submitting with no selection', () => {
		component.submit();
		expect(dialogRef.close).not.toHaveBeenCalled();
	});

	it('should close with undefined on cancel', () => {
		component.cancel();
		expect(dialogRef.close).toHaveBeenCalledWith(undefined);
	});

	it('should update selectedId via onSelect with a real change event', () => {
		const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
		select.value = 'folder-1';
		select.dispatchEvent(new Event('change'));
		expect(component.selectedId()).toBe('folder-1');
	});

	it('should use default confirmText when not provided', async () => {
		const dataWithoutConfirm: SelectDialogData = {
			title: 'Test',
			label: 'Pick',
			options: [{ id: '1', name: 'One' }],
		};

		TestBed.resetTestingModule();
		await TestBed.configureTestingModule({
			imports: [SelectDialog],
			providers: [
				{ provide: DialogRef, useValue: createMockDialogRef<string | undefined>() },
				{ provide: DIALOG_DATA, useValue: dataWithoutConfirm },
			],
		}).compileComponents();

		const fixture2 = TestBed.createComponent(SelectDialog);
		fixture2.detectChanges();

		const buttons = fixture2.nativeElement.querySelectorAll('button');
		const submitBtn = Array.from(buttons).find(
			(b) => (b as HTMLButtonElement).textContent?.trim() === 'Confirm',
		) as HTMLButtonElement;
		expect(submitBtn).toBeTruthy();
	});

	it('should generate unique select IDs across instances', () => {
		const fixture2 = TestBed.createComponent(SelectDialog);
		fixture2.detectChanges();
		expect(component.selectId).not.toBe(fixture2.componentInstance.selectId);
	});
});
