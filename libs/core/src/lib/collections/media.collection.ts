/**
 * Built-in Media Collection for Momentum CMS
 * Stores metadata for uploaded files
 */

import { defineCollection } from './define-collection';
import { text, number, json } from '../fields';
import type { ValidateFunction } from '../fields/field.types';

/**
 * Validates a focalPoint value: null/undefined is allowed (optional field).
 * When present, must be a plain object with exactly `x` and `y` properties,
 * both finite numbers in the [0, 1] range.
 */
export const validateFocalPoint: ValidateFunction = (value) => {
	if (value === null || value === undefined) return true;

	if (typeof value !== 'object' || Array.isArray(value)) {
		return 'Focal point must be an object with x and y coordinates';
	}

	// After the typeof/Array checks, value is a non-null object
	const fp = Object.fromEntries(Object.entries(value));

	if (!('x' in fp) || !('y' in fp)) {
		return 'Focal point must have both x and y properties';
	}

	const { x, y } = fp;

	if (typeof x !== 'number' || !Number.isFinite(x)) {
		return 'Focal point x must be a finite number';
	}
	if (typeof y !== 'number' || !Number.isFinite(y)) {
		return 'Focal point y must be a finite number';
	}

	if (x < 0 || x > 1) {
		return `Focal point x must be between 0 and 1 (received ${x})`;
	}
	if (y < 0 || y > 1) {
		return `Focal point y must be between 0 and 1 (received ${y})`;
	}

	return true;
};

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
	upload: {
		mimeTypes: ['image/*', 'application/pdf', 'video/*', 'audio/*'],
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
			validate: validateFocalPoint,
			admin: {
				hidden: true,
			},
		}),
		json('sizes', {
			label: 'Image Sizes',
			description: 'Generated image size variants',
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
	sizes?: Record<
		string,
		{
			url: string;
			path: string;
			width: number;
			height: number;
			mimeType: string;
			filesize: number;
		}
	>;
	createdAt: string;
	updatedAt: string;
}
