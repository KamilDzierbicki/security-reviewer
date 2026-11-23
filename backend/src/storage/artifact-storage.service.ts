import { createReadStream, createWriteStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { storageConfig } from '../config/namespaces.js';

export interface StoredArtifact {
  key: string;
  lastModified: Date | undefined;
}

@Injectable()
export class ArtifactStorageService {
  private readonly logger = new Logger(ArtifactStorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(
    @Inject(storageConfig.KEY) storage: ConfigType<typeof storageConfig>,
  ) {
    this.bucket = storage.bucket;
    this.client = new S3Client({
      endpoint: storage.endpoint,
      region: storage.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: storage.accessKey,
        secretAccessKey: storage.secretKey,
      },
    });
  }

  keyFor(runId: string, attempt: number): string {
    return `${runId}/${attempt}.tar.gz`;
  }

  runIdOf(key: string): string {
    return key.split('/')[0];
  }

  async ensureBucket(): Promise<void> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch {
      await this.client.send(new CreateBucketCommand({ Bucket: this.bucket }));
      this.logger.log('Created bucket', { bucket: this.bucket });
    }
  }

  async upload(runId: string, attempt: number, file: string): Promise<void> {
    const { size } = await stat(file);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(runId, attempt),
        Body: createReadStream(file),
        ContentLength: size,
        ContentType: 'application/gzip',
      }),
    );
  }

  async download(runId: string, attempt: number, file: string): Promise<void> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.keyFor(runId, attempt),
      }),
    );
    await pipeline(response.Body as Readable, createWriteStream(file));
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }

  async list(): Promise<StoredArtifact[]> {
    const items: StoredArtifact[] = [];
    let token: string | undefined;
    do {
      const page = await this.client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          ContinuationToken: token,
        }),
      );
      for (const object of page.Contents ?? []) {
        if (object.Key) {
          items.push({ key: object.Key, lastModified: object.LastModified });
        }
      }
      token = page.NextContinuationToken;
    } while (token);
    return items;
  }
}
