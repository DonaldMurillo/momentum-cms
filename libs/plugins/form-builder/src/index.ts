// Form builder plugin
export { formBuilderPlugin } from './lib/form-builder-plugin';

// Config types
export type { FormBuilderPluginConfig } from './lib/types/form-builder-plugin-config.types';

// Collections (for external reference/testing)
export { FormsCollection } from './lib/collections/forms.collection';
export { FormSubmissionsCollection } from './lib/collections/form-submissions.collection';

// Webhook types
export type { FormWebhookConfig, FormSubmissionPayload } from './lib/services/submission-forwarder';
