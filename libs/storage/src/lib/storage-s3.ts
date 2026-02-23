/**
 * S3-compatible Storage Adapter
 * Stores files in Amazon S3 or compatible services (MinIO, DigitalOcean Spaces, etc.)
 */

import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { StorageAdapter, UploadedFile, StoredFile, UploadOptions } from '@momentumcms/core';
import type { S3StorageOptions } from './storage.types';
import { getExtensionFromMimeType } from './storage-utils';

// Dynamic import for AWS SDK to avoid bundling issues
let S3Client: typeof import('@aws-sdk/client-s3').S3Client;
let PutObjectCommand: typeof import('@aws-sdk/client-s3').PutObjectCommand;
let DeleteObjectCommand: typeof import('@aws-sdk/client-s3').DeleteObjectCommand;
let HeadObjectCommand: typeof import('@aws-sdk/client-s3').HeadObjectCommand;
let GetObjectCommand: typeof import('@aws-sdk/client-s3').GetObjectCommand;
let getSignedUrl: typeof import('@aws-sdk/s3-request-presigner').getSignedUrl;

/**
 * Load AWS SDK modules dynamically.
 */
async function loadAwsSdk(): Promise<void> {
	if (S3Client) return;

	const s3Module = await import('@aws-sdk/client-s3');
	const presignerModule = await import('@aws-sdk/s3-request-presigner');

	S3Client = s3Module.S3Client;
	PutObjectCommand = s3Module.PutObjectCommand;
	DeleteObjectCommand = s3Module.DeleteObjectCommand;
	HeadObjectCommand = s3Module.HeadObjectCommand;
	GetObjectCommand = s3Module.GetObjectCommand;
	getSignedUrl = presignerModule.getSignedUrl;
}

/**
 * Creates an S3-compatible storage adapter.
 *
 * @example
 * ```typescript
 * // Amazon S3
 * const storage = s3StorageAdapter({
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 * });
 *
 * // MinIO
 * const storage = s3StorageAdapter({
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   endpoint: 'http://localhost:9000',
 *   forcePathStyle: true,
 * });
 * ```
 */
export function s3StorageAdapter(options: S3StorageOptions): StorageAdapter {
	const {
		bucket,
		region,
		accessKeyId,
		secretAccessKey,
		endpoint,
		baseUrl,
		forcePathStyle = false,
		acl = 'private',
		presignedUrlExpiry = 3600,
	} = options;

	// Lazy-initialized S3 client
	let client: InstanceType<typeof S3Client> | null = null;

	async function getClient(): Promise<InstanceType<typeof S3Client>> {
		await loadAwsSdk();

		if (!client) {
			const clientConfig: ConstructorParameters<typeof S3Client>[0] = {
				region,
				forcePathStyle,
			};

			if (endpoint) {
				clientConfig.endpoint = endpoint;
			}

			if (accessKeyId && secretAccessKey) {
				clientConfig.credentials = {
					accessKeyId,
					secretAccessKey,
				};
			}

			client = new S3Client(clientConfig);
		}

		return client;
	}

	/**
	 * Get the public URL for a file.
	 */
	function getPublicUrl(key: string): string {
		if (baseUrl) {
			return `${baseUrl}/${key}`;
		}
		if (endpoint) {
			return `${endpoint}/${bucket}/${key}`;
		}
		return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
	}

	return {
		async upload(file: UploadedFile, uploadOptions?: UploadOptions): Promise<StoredFile> {
			const s3 = await getClient();

			// Generate unique key
			const ext = extname(file.originalName) || getExtensionFromMimeType(file.mimeType);
			const filename = uploadOptions?.filename
				? `${uploadOptions.filename}${ext}`
				: `${randomUUID()}${ext}`;

			// Build the S3 key
			const key = uploadOptions?.directory ? `${uploadOptions.directory}/${filename}` : filename;

			// Upload to S3
			await s3.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: file.buffer,
					ContentType: file.mimeType,
					ACL: acl,
				}),
			);

			return {
				path: key,
				url: acl === 'public-read' ? getPublicUrl(key) : `/api/media/file/${key}`,
				filename,
				mimeType: file.mimeType,
				size: file.size,
			};
		},

		async delete(path: string): Promise<boolean> {
			const s3 = await getClient();

			try {
				await s3.send(
					new DeleteObjectCommand({
						Bucket: bucket,
						Key: path,
					}),
				);
				return true;
			} catch {
				return false;
			}
		},

		getUrl(path: string): string {
			if (acl === 'public-read') {
				return getPublicUrl(path);
			}
			return `/api/media/file/${path}`;
		},

		async exists(path: string): Promise<boolean> {
			const s3 = await getClient();

			try {
				await s3.send(
					new HeadObjectCommand({
						Bucket: bucket,
						Key: path,
					}),
				);
				return true;
			} catch {
				return false;
			}
		},

		async getSignedUrl(path: string, expiresIn?: number): Promise<string> {
			const s3 = await getClient();
			await loadAwsSdk();

			const command = new GetObjectCommand({
				Bucket: bucket,
				Key: path,
			});

			return getSignedUrl(s3, command, {
				expiresIn: expiresIn ?? presignedUrlExpiry,
			});
		},

		async read(path: string): Promise<Buffer | null> {
			const s3 = await getClient();

			try {
				const response = await s3.send(
					new GetObjectCommand({
						Bucket: bucket,
						Key: path,
					}),
				);

				if (!response.Body) {
					return null;
				}

				// Convert stream to buffer
				const chunks: Uint8Array[] = [];
				// eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- AWS SDK Body type needs cast to iterate
				const body = response.Body as AsyncIterable<Uint8Array>;
				for await (const chunk of body) {
					chunks.push(chunk);
				}
				return Buffer.concat(chunks);
			} catch {
				return null;
			}
		},
	};
}
