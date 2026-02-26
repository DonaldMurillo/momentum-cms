import { describe, it, expect } from 'vitest';
import { Component, ChangeDetectionStrategy } from '@angular/core';
import { renderEmail } from '../render/render-email';
import { EmlBody } from './eml-body.component';
import { EmlContainer } from './eml-container.component';
import { EmlSection } from './eml-section.component';
import { EmlRow } from './eml-row.component';
import { EmlColumn } from './eml-column.component';
import { EmlText } from './eml-text.component';
import { EmlHeading } from './eml-heading.component';
import { EmlButton } from './eml-button.component';
import { EmlLink } from './eml-link.component';
import { EmlImage } from './eml-image.component';
import { EmlDivider } from './eml-divider.component';
import { EmlPreview } from './eml-preview.component';
import { EmlSpacer } from './eml-spacer.component';
import { EmlFooter } from './eml-footer.component';
import { injectEmailData } from '../render/render-types';

const opts = { inlineCss: false, stripArtifacts: true };

// ─── EmlBody ───────────────────────────────────────────────
@Component({
	selector: 'test-body-default',
	imports: [EmlBody],
	template: `<eml-body>Hello</eml-body>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestBodyDefault {}

@Component({
	selector: 'test-body-custom',
	imports: [EmlBody],
	template: `<eml-body backgroundColor="#000" padding="10px">Custom</eml-body>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestBodyCustom {}

// ─── EmlContainer ──────────────────────────────────────────
@Component({
	selector: 'test-container-default',
	imports: [EmlContainer],
	template: `<eml-container>Content</eml-container>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestContainerDefault {}

@Component({
	selector: 'test-container-custom',
	imports: [EmlContainer],
	template: `<eml-container
		maxWidth="600px"
		backgroundColor="#f0f0f0"
		borderRadius="0"
		padding="20px"
		>Styled</eml-container
	>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestContainerCustom {}

// ─── EmlSection ────────────────────────────────────────────
@Component({
	selector: 'test-section-default',
	imports: [EmlSection],
	template: `<eml-section>Section</eml-section>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSectionDefault {}

@Component({
	selector: 'test-section-custom',
	imports: [EmlSection],
	template: `<eml-section padding="16px">Padded</eml-section>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSectionCustom {}

// ─── EmlRow + EmlColumn ────────────────────────────────────
@Component({
	selector: 'test-row-column',
	imports: [EmlRow, EmlColumn],
	template: `
		<eml-row>
			<eml-column width="50%">Left</eml-column>
			<eml-column width="50%">Right</eml-column>
		</eml-row>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestRowColumn {}

@Component({
	selector: 'test-column-custom',
	imports: [EmlRow, EmlColumn],
	template: `
		<eml-row>
			<eml-column padding="8px" verticalAlign="middle">Cell</eml-column>
		</eml-row>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestColumnCustom {}

// ─── EmlText ───────────────────────────────────────────────
@Component({
	selector: 'test-text-default',
	imports: [EmlText],
	template: `<eml-text>Hello world</eml-text>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestTextDefault {}

@Component({
	selector: 'test-text-custom',
	imports: [EmlText],
	template: `<eml-text color="#ff0000" fontSize="14px" textAlign="center">Styled text</eml-text>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestTextCustom {}

// ─── EmlHeading ────────────────────────────────────────────
@Component({
	selector: 'test-heading-default',
	imports: [EmlHeading],
	template: `<eml-heading>Title</eml-heading>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHeadingDefault {}

@Component({
	selector: 'test-heading-h2',
	imports: [EmlHeading],
	template: `<eml-heading level="2" color="#333" textAlign="center">Subtitle</eml-heading>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestHeadingH2 {}

// ─── EmlButton ─────────────────────────────────────────────
@Component({
	selector: 'test-button-default',
	imports: [EmlButton],
	template: `<eml-button href="https://example.com">Click me</eml-button>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestButtonDefault {}

@Component({
	selector: 'test-button-custom',
	imports: [EmlButton],
	template: `<eml-button
		href="https://example.com"
		backgroundColor="#0066cc"
		color="#fff"
		borderRadius="20px"
		textAlign="center"
		>Go</eml-button
	>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestButtonCustom {}

// ─── EmlLink ───────────────────────────────────────────────
@Component({
	selector: 'test-link-default',
	imports: [EmlLink],
	template: `<eml-link href="https://example.com">Link text</eml-link>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestLinkDefault {}

@Component({
	selector: 'test-link-custom',
	imports: [EmlLink],
	template: `<eml-link href="https://example.com" color="#0066cc" textDecoration="none"
		>No underline</eml-link
	>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestLinkCustom {}

// ─── EmlImage ──────────────────────────────────────────────
@Component({
	selector: 'test-image-default',
	imports: [EmlImage],
	template: `<eml-image src="https://example.com/logo.png" alt="Logo" />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestImageDefault {}

@Component({
	selector: 'test-image-custom',
	imports: [EmlImage],
	template: `<eml-image
		src="https://example.com/photo.jpg"
		alt="Photo"
		width="400"
		height="300"
		borderRadius="8px"
	/>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestImageCustom {}

// ─── EmlDivider ────────────────────────────────────────────
@Component({
	selector: 'test-divider-default',
	imports: [EmlDivider],
	template: `<eml-divider />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDividerDefault {}

@Component({
	selector: 'test-divider-custom',
	imports: [EmlDivider],
	template: `<eml-divider color="#000" margin="32px 0" />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestDividerCustom {}

// ─── EmlPreview ────────────────────────────────────────────
@Component({
	selector: 'test-preview',
	imports: [EmlPreview],
	template: `<eml-preview>Preview text for email clients</eml-preview>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestPreview {}

// ─── EmlSpacer ─────────────────────────────────────────────
@Component({
	selector: 'test-spacer-default',
	imports: [EmlSpacer],
	template: `<eml-spacer />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSpacerDefault {}

@Component({
	selector: 'test-spacer-custom',
	imports: [EmlSpacer],
	template: `<eml-spacer height="48px" />`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestSpacerCustom {}

// ─── EmlFooter ─────────────────────────────────────────────
@Component({
	selector: 'test-footer-default',
	imports: [EmlFooter],
	template: `<eml-footer>© 2026 Company</eml-footer>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestFooterDefault {}

@Component({
	selector: 'test-footer-custom',
	imports: [EmlFooter],
	template: `<eml-footer
		maxWidth="600px"
		color="#999"
		fontSize="10px"
		textAlign="left"
		padding="10px 0"
		>Small footer</eml-footer
	>`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestFooterCustom {}

// ─── Full email composition ────────────────────────────────
interface WelcomeData {
	name: string;
	url: string;
}

@Component({
	selector: 'test-full-email',
	imports: [
		EmlBody,
		EmlContainer,
		EmlPreview,
		EmlHeading,
		EmlText,
		EmlButton,
		EmlDivider,
		EmlFooter,
	],
	template: `
		<eml-body>
			<eml-preview>Welcome aboard!</eml-preview>
			<eml-container>
				<eml-heading>Welcome, {{ data.name }}!</eml-heading>
				<eml-text>Thanks for signing up.</eml-text>
				<eml-button href="{{ data.url }}" textAlign="center">Get Started</eml-button>
				<eml-divider />
				<eml-footer>You received this because you signed up.</eml-footer>
			</eml-container>
		</eml-body>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestFullEmail {
	readonly data = injectEmailData<WelcomeData>();
}

// ─── Tests ─────────────────────────────────────────────────

describe('EmlBody', () => {
	it('renders table layout with default styles', async () => {
		const html = await renderEmail(TestBodyDefault, {}, opts);
		expect(html).toContain('role="presentation"');
		expect(html).toContain('background-color: #f4f4f5');
		expect(html).toContain('padding: 40px 20px');
		expect(html).toContain('Hello');
	});

	it('accepts custom backgroundColor and padding', async () => {
		const html = await renderEmail(TestBodyCustom, {}, opts);
		expect(html).toContain('background-color: #000');
		expect(html).toContain('padding: 10px');
		expect(html).toContain('Custom');
	});
});

describe('EmlContainer', () => {
	it('renders table with default max-width and styles', async () => {
		const html = await renderEmail(TestContainerDefault, {}, opts);
		expect(html).toContain('max-width: 480px');
		expect(html).toContain('background-color: #ffffff');
		expect(html).toContain('border-radius: 8px');
		expect(html).toContain('padding: 40px');
		expect(html).toContain('Content');
	});

	it('accepts custom styles', async () => {
		const html = await renderEmail(TestContainerCustom, {}, opts);
		expect(html).toContain('max-width: 600px');
		expect(html).toContain('background-color: #f0f0f0');
		expect(html).toContain('border-radius: 0');
		expect(html).toContain('padding: 20px');
		expect(html).toContain('Styled');
	});
});

describe('EmlSection', () => {
	it('renders table with default padding', async () => {
		const html = await renderEmail(TestSectionDefault, {}, opts);
		expect(html).toContain('padding: 0');
		expect(html).toContain('Section');
	});

	it('accepts custom padding', async () => {
		const html = await renderEmail(TestSectionCustom, {}, opts);
		expect(html).toContain('padding: 16px');
		expect(html).toContain('Padded');
	});
});

describe('EmlRow + EmlColumn', () => {
	it('renders two-column layout', async () => {
		const html = await renderEmail(TestRowColumn, {}, opts);
		expect(html).toContain('<td');
		expect(html).toContain('width="50%"');
		expect(html).toContain('Left');
		expect(html).toContain('Right');
	});

	it('accepts custom column padding and vertical-align', async () => {
		const html = await renderEmail(TestColumnCustom, {}, opts);
		expect(html).toContain('padding: 8px');
		expect(html).toContain('vertical-align: middle');
		expect(html).toContain('Cell');
	});
});

describe('EmlText', () => {
	it('renders paragraph with default styles', async () => {
		const html = await renderEmail(TestTextDefault, {}, opts);
		expect(html).toContain('<p');
		expect(html).toContain('color: #3f3f46');
		expect(html).toContain('font-size: 16px');
		expect(html).toContain('text-align: left');
		expect(html).toContain('Hello world');
	});

	it('accepts custom color, fontSize, and textAlign', async () => {
		const html = await renderEmail(TestTextCustom, {}, opts);
		expect(html).toContain('color: #ff0000');
		expect(html).toContain('font-size: 14px');
		expect(html).toContain('text-align: center');
		expect(html).toContain('Styled text');
	});
});

describe('EmlHeading', () => {
	it('renders level 1 heading with default styles', async () => {
		const html = await renderEmail(TestHeadingDefault, {}, opts);
		expect(html).toContain('role="heading"');
		expect(html).toContain('aria-level="1"');
		expect(html).toContain('font-size: 24px');
		expect(html).toContain('font-weight: 600');
		expect(html).toContain('Title');
	});

	it('renders level 2 heading with custom styles', async () => {
		const html = await renderEmail(TestHeadingH2, {}, opts);
		expect(html).toContain('aria-level="2"');
		expect(html).toContain('font-size: 20px');
		expect(html).toContain('color: #333');
		expect(html).toContain('text-align: center');
		expect(html).toContain('Subtitle');
	});
});

describe('EmlButton', () => {
	it('renders button with default styles', async () => {
		const html = await renderEmail(TestButtonDefault, {}, opts);
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('background-color: #18181b');
		expect(html).toContain('color: #ffffff');
		expect(html).toContain('border-radius: 6px');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('Click me');
	});

	it('accepts custom backgroundColor, color, borderRadius, and textAlign', async () => {
		const html = await renderEmail(TestButtonCustom, {}, opts);
		expect(html).toContain('background-color: #0066cc');
		expect(html).toContain('color: #fff');
		expect(html).toContain('border-radius: 20px');
		expect(html).toContain('text-align: center');
		expect(html).toContain('Go');
	});
});

describe('EmlLink', () => {
	it('renders link with default styles', async () => {
		const html = await renderEmail(TestLinkDefault, {}, opts);
		expect(html).toContain('href="https://example.com"');
		expect(html).toContain('color: #18181b');
		expect(html).toContain('text-decoration: underline');
		expect(html).toContain('target="_blank"');
		expect(html).toContain('Link text');
	});

	it('accepts custom color and textDecoration', async () => {
		const html = await renderEmail(TestLinkCustom, {}, opts);
		expect(html).toContain('color: #0066cc');
		expect(html).toContain('text-decoration: none');
		expect(html).toContain('No underline');
	});
});

describe('EmlImage', () => {
	it('renders image with required attrs', async () => {
		const html = await renderEmail(TestImageDefault, {}, opts);
		expect(html).toContain('src="https://example.com/logo.png"');
		expect(html).toContain('alt="Logo"');
		expect(html).toContain('max-width: 100%');
		expect(html).toContain('border: 0');
	});

	it('accepts width, height, and borderRadius', async () => {
		const html = await renderEmail(TestImageCustom, {}, opts);
		expect(html).toContain('src="https://example.com/photo.jpg"');
		expect(html).toContain('alt="Photo"');
		expect(html).toContain('width="400"');
		expect(html).toContain('height="300"');
		expect(html).toContain('border-radius: 8px');
	});
});

describe('EmlDivider', () => {
	it('renders hr with default styles', async () => {
		const html = await renderEmail(TestDividerDefault, {}, opts);
		expect(html).toContain('<hr');
		expect(html).toContain('border-top: 1px solid #e4e4e7');
		expect(html).toContain('margin: 24px 0');
	});

	it('accepts custom color and margin', async () => {
		const html = await renderEmail(TestDividerCustom, {}, opts);
		expect(html).toContain('border-top: 1px solid #000');
		expect(html).toContain('margin: 32px 0');
	});
});

describe('EmlPreview', () => {
	it('renders hidden preview text', async () => {
		const html = await renderEmail(TestPreview, {}, opts);
		expect(html).toContain('display: none');
		expect(html).toContain('max-height: 0');
		expect(html).toContain('overflow: hidden');
		expect(html).toContain('mso-hide: all');
		expect(html).toContain('Preview text for email clients');
	});
});

describe('EmlSpacer', () => {
	it('renders with default 24px height', async () => {
		const html = await renderEmail(TestSpacerDefault, {}, opts);
		expect(html).toContain('height: 24px');
		expect(html).toContain('line-height: 24px');
	});

	it('accepts custom height', async () => {
		const html = await renderEmail(TestSpacerCustom, {}, opts);
		expect(html).toContain('height: 48px');
		expect(html).toContain('line-height: 48px');
	});
});

describe('EmlFooter', () => {
	it('renders table with default styles', async () => {
		const html = await renderEmail(TestFooterDefault, {}, opts);
		expect(html).toContain('max-width: 480px');
		expect(html).toContain('color: #71717a');
		expect(html).toContain('font-size: 12px');
		expect(html).toContain('text-align: center');
		expect(html).toContain('© 2026 Company');
	});

	it('accepts custom styles', async () => {
		const html = await renderEmail(TestFooterCustom, {}, opts);
		expect(html).toContain('max-width: 600px');
		expect(html).toContain('color: #999');
		expect(html).toContain('font-size: 10px');
		expect(html).toContain('text-align: left');
		expect(html).toContain('padding: 10px 0');
		expect(html).toContain('Small footer');
	});
});

describe('Full email composition', () => {
	it('renders a complete email with data injection', async () => {
		const html = await renderEmail<WelcomeData>(
			TestFullEmail,
			{ name: 'Alice', url: 'https://example.com/start' },
			opts,
		);
		// Body wrapper
		expect(html).toContain('background-color: #f4f4f5');
		// Container
		expect(html).toContain('max-width: 480px');
		// Preview
		expect(html).toContain('Welcome aboard!');
		// Heading with injected data
		expect(html).toContain('Welcome, Alice!');
		// Text
		expect(html).toContain('Thanks for signing up.');
		// Button with data-injected href
		expect(html).toContain('href="https://example.com/start"');
		expect(html).toContain('Get Started');
		// Divider
		expect(html).toContain('<hr');
		// Footer
		expect(html).toContain('You received this because you signed up.');
	});
});
