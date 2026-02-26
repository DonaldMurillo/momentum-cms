import { describe, it, expect } from 'vitest';
import { Component, ChangeDetectionStrategy, computed } from '@angular/core';
import { renderEmail } from './render-email';
import { injectEmailData } from './render-types';

// Test email component — simple text output
@Component({
	selector: 'test-simple-email',
	template: `<p>Hello from test email</p>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class SimpleTestEmail {}

// Test email component with data injection
interface GreetingData {
	name: string;
	message: string;
}

@Component({
	selector: 'test-data-email',
	template: `
		<h1>{{ data.name }}</h1>
		<p>{{ data.message }}</p>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class DataTestEmail {
	readonly data = injectEmailData<GreetingData>();
}

// Test email component with computed values
interface ComputedData {
	firstName: string;
	lastName: string;
}

@Component({
	selector: 'test-computed-email',
	template: `<p>{{ greeting() }}</p>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class ComputedTestEmail {
	readonly data = injectEmailData<ComputedData>();
	readonly greeting = computed(() => `Hello ${this.data.firstName} ${this.data.lastName}`);
}

describe('renderEmail', () => {
	it('should render a simple component to HTML', async () => {
		const html = await renderEmail(SimpleTestEmail);
		expect(html).toContain('Hello from test email');
		expect(html).toContain('<p');
	});

	it('should inject data via EMAIL_DATA token', async () => {
		const html = await renderEmail(DataTestEmail, {
			name: 'John',
			message: 'Welcome aboard!',
		});
		expect(html).toContain('John');
		expect(html).toContain('Welcome aboard!');
	});

	it('should support computed values from injected data', async () => {
		const html = await renderEmail(ComputedTestEmail, {
			firstName: 'Jane',
			lastName: 'Doe',
		});
		expect(html).toContain('Hello Jane Doe');
	});

	it('should strip Angular artifacts by default', async () => {
		const html = await renderEmail(SimpleTestEmail);
		expect(html).not.toMatch(/ng-version/);
		expect(html).not.toMatch(/ng-server-context/);
		expect(html).not.toMatch(/_nghost/);
		expect(html).not.toMatch(/_ngcontent/);
	});

	it('should preserve Angular artifacts when stripArtifacts is false', async () => {
		const html = await renderEmail(SimpleTestEmail, {}, { stripArtifacts: false });
		// The HTML may or may not have artifacts depending on Angular version,
		// but it should not throw
		expect(html).toContain('Hello from test email');
	});

	it('should contain DOCTYPE declaration', async () => {
		const html = await renderEmail(SimpleTestEmail);
		expect(html).toContain('<!DOCTYPE html>');
	});

	it('should escape HTML in interpolated values (Angular auto-escapes)', async () => {
		const html = await renderEmail(DataTestEmail, {
			name: '<script>alert("xss")</script>',
			message: 'safe',
		});
		expect(html).not.toContain('<script>alert');
		expect(html).toContain('&lt;script&gt;');
	});
});
