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

export interface PasswordResetEmailData {
	name?: string;
	url: string;
	appName: string;
	expiresIn: string;
}

@Component({
	selector: 'auth-password-reset-email',
	imports: [EmlBody, EmlContainer, EmlHeading, EmlText, EmlButton, EmlDivider, EmlFooter],
	template: `
		<eml-body>
			<eml-container>
				<eml-heading>Reset your password</eml-heading>
				<eml-text>{{ greeting }}</eml-text>
				<eml-text>
					We received a request to reset your password. Click the button below to choose a new
					password:
				</eml-text>
				<eml-button [href]="data.url">Reset Password</eml-button>
				<eml-text color="#71717a" fontSize="14px">
					This link will expire in {{ data.expiresIn }}.
				</eml-text>
				<eml-text color="#71717a" fontSize="14px">
					If you didn't request a password reset, you can safely ignore this email.
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
export class PasswordResetEmailComponent {
	readonly data = injectEmailData<PasswordResetEmailData>();
	readonly year = new Date().getFullYear();

	get greeting(): string {
		return this.data.name ? `Hi ${this.data.name},` : 'Hi,';
	}
}
