/**
 * Built-in Media Collection for Momentum CMS
 * Stores metadata for uploaded files
 */

import { defineCollection } from './define-collection';
import { text, number, json } from '../fields';

/**
 * Built-in Media collection for storing file upload metadata.
 * Users can override this by defining their own 'media' collection.
 */
export const MediaCollection = defineCollection({
	slug: 'media',
	labels: {
		singular: 'Media',
		plural: 'Media',
	},
	admin: {
		useAsTitle: 'filename',
		defaultColumns: ['filename', 'mimeType', 'filesize', 'createdAt'],
	},
	fields: [
		text('filename', {
			required: true,
			label: 'Filename',
			description: 'Original filename of the uploaded file',
		}),
		text('mimeType', {
			required: true,
			label: 'MIME Type',
			description: 'File MIME type (e.g., image/jpeg, application/pdf)',
		}),
		number('filesize', {
			label: 'File Size',
			description: 'File size in bytes',
		}),
		text('path', {
			required: true,
			label: 'Storage Path',
			description: 'Path/key where the file is stored',
			admin: {
				hidden: true,
			},
		}),
		text('url', {
			label: 'URL',
			description: 'Public URL to access the file',
		}),
		text('alt', {
			label: 'Alt Text',
			description: 'Alternative text for accessibility',
		}),
		number('width', {
			label: 'Width',
			description: 'Image width in pixels (for images only)',
		}),
		number('height', {
			label: 'Height',
			description: 'Image height in pixels (for images only)',
		}),
		json('focalPoint', {
			label: 'Focal Point',
			description: 'Focal point coordinates for image cropping',
			admin: {
				hidden: true,
			},
		}),
	],
	access: {
		// Media is readable by anyone by default
		read: () => true,
		// Only authenticated users can create/update/delete
		create: ({ req }) => !!req?.user,
		update: ({ req }) => !!req?.user,
		delete: ({ req }) => !!req?.user,
	},
});

/**
 * Type for a media document.
 */
export interface MediaDocument {
	id: string;
	filename: string;
	mimeType: string;
	filesize?: number;
	path: string;
	url?: string;
	alt?: string;
	width?: number;
	height?: number;
	focalPoint?: { x: number; y: number };
	createdAt: string;
	updatedAt: string;
}
