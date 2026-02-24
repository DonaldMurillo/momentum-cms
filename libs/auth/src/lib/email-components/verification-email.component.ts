import { Component, ChangeDetectionStrategy } from '@angular/core';
import {
	EmlBody,
	EmlContainer,
	EmlHeading,
	EmlText,
	EmlButton,
	EmlDivider,
	EmlFooter,
} from '@momentumcms/email';
import { injectEmailData } from '@momentumcms/email';

export interface VerificationEmailData {
	name?: string;
	url: string;
	appName: string;
	expiresIn: string;
}

@Component({
	selector: 'auth-verification-email',
	imports: [EmlBody, EmlContainer, EmlHeading, EmlText, EmlButton, EmlDivider, EmlFooter],
	template: `
		<eml-body>
			<eml-container>
				<eml-heading>Verify your email</eml-heading>
				<eml-text>{{ greeting }}</eml-text>
				<eml-text>
					Welcome to {{ data.appName }}! Please verify your email address by clicking the button
					below:
				</eml-text>
				<eml-button [href]="data.url">Verify Email</eml-button>
				<eml-text color="#71717a" fontSize="14px">
					This link will expire in {{ data.expiresIn }}.
				</eml-text>
				<eml-text color="#71717a" fontSize="14px">
					If you didn't create an account, you can safely ignore this email.
				</eml-text>
				<eml-divider />
				<eml-text color="#71717a" fontSize="12px">
					If the button doesn't work, copy and paste this URL into your browser:
				</eml-text>
				<eml-text color="#71717a" fontSize="12px">{{ data.url }}</eml-text>
			</eml-container>
			<eml-footer> &copy; {{ year }} {{ data.appName }}. All rights reserved. </eml-footer>
		</eml-body>
	`,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerificationEmailComponent {
	readonly data = injectEmailData<VerificationEmailData>();
	readonly year = new Date().getFullYear();

	get greeting(): string {
		return this.data.name ? `Hi ${this.data.name},` : 'Hi,';
	}
}
