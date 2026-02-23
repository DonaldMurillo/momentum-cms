import { describe, it, expect } from 'vitest';
import { getExtensionFromMimeType } from './storage-utils';

describe('getExtensionFromMimeType', () => {
	it('should return .jpg for image/jpeg', () => {
		expect(getExtensionFromMimeType('image/jpeg')).toBe('.jpg');
	});

	it('should return .png for image/png', () => {
		expect(getExtensionFromMimeType('image/png')).toBe('.png');
	});

	it('should return .gif for image/gif', () => {
		expect(getExtensionFromMimeType('image/gif')).toBe('.gif');
	});

	it('should return .webp for image/webp', () => {
		expect(getExtensionFromMimeType('image/webp')).toBe('.webp');
	});

	it('should return .svg for image/svg+xml', () => {
		expect(getExtensionFromMimeType('image/svg+xml')).toBe('.svg');
	});

	it('should return .pdf for application/pdf', () => {
		expect(getExtensionFromMimeType('application/pdf')).toBe('.pdf');
	});

	it('should return .json for application/json', () => {
		expect(getExtensionFromMimeType('application/json')).toBe('.json');
	});

	it('should return .mp4 for video/mp4', () => {
		expect(getExtensionFromMimeType('video/mp4')).toBe('.mp4');
	});

	it('should return .mp3 for audio/mpeg', () => {
		expect(getExtensionFromMimeType('audio/mpeg')).toBe('.mp3');
	});

	it('should return .zip for application/zip', () => {
		expect(getExtensionFromMimeType('application/zip')).toBe('.zip');
	});

	it('should return empty string for unknown MIME type', () => {
		expect(getExtensionFromMimeType('application/octet-stream')).toBe('');
	});

	it('should return empty string for empty string', () => {
		expect(getExtensionFromMimeType('')).toBe('');
	});
});
