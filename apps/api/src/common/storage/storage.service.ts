import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Minio from 'minio';
import { config } from '@trades/config';
import { v4 as uuidv4 } from 'uuid';

export interface UploadResult {
  url: string;
  key: string;
  bucket: string;
}

export interface PresignedUrlResult {
  uploadUrl: string;
  key: string;
  publicUrl: string;
}

@Injectable()
export class StorageService implements OnModuleInit {
  private client: Minio.Client;
  private bucket: string;

  async onModuleInit() {
    const url = new URL(config.STORAGE_ENDPOINT);

    this.client = new Minio.Client({
      endPoint: url.hostname,
      port: url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 9000),
      useSSL: url.protocol === 'https:',
      accessKey: config.STORAGE_ACCESS_KEY,
      secretKey: config.STORAGE_SECRET_KEY,
    });

    this.bucket = config.STORAGE_BUCKET;

    // Ensure bucket exists
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket);
        console.log(`📂 Created bucket: ${this.bucket}`);
      }
    } catch (error) {
      console.error('Storage bucket error:', error);
    }
  }

  /**
   * Generate a presigned URL for direct upload
   */
  async getPresignedUploadUrl(
    folder: string,
    filename: string,
    contentType: string,
    expirySeconds: number = 3600,
  ): Promise<PresignedUrlResult> {
    const key = `${folder}/${uuidv4()}-${filename}`;

    const uploadUrl = await this.client.presignedPutObject(
      this.bucket,
      key,
      expirySeconds,
    );

    return {
      uploadUrl,
      key,
      publicUrl: this.getPublicUrl(key),
    };
  }

  /**
   * Generate a presigned URL for download
   */
  async getPresignedDownloadUrl(
    key: string,
    expirySeconds: number = 3600,
  ): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expirySeconds);
  }

  /**
   * Upload a file directly (for server-side uploads)
   */
  async uploadFile(
    folder: string,
    filename: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<UploadResult> {
    const key = `${folder}/${uuidv4()}-${filename}`;

    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': contentType,
    });

    return {
      url: this.getPublicUrl(key),
      key,
      bucket: this.bucket,
    };
  }

  /**
   * Delete a file
   */
  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  /**
   * Get public URL for a file
   */
  getPublicUrl(key: string): string {
    return `${config.STORAGE_ENDPOINT}/${this.bucket}/${key}`;
  }

  /**
   * Check if a file exists
   */
  async fileExists(key: string): Promise<boolean> {
    try {
      await this.client.statObject(this.bucket, key);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get file metadata
   */
  async getFileInfo(key: string): Promise<Minio.BucketItemStat | null> {
    try {
      return await this.client.statObject(this.bucket, key);
    } catch {
      return null;
    }
  }
}
