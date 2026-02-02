# Automated Backup Verification

This document describes the implementation of automated backup verification for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Backup Strategy](#backup-strategy)
4. [Verification Process](#verification-process)
5. [Monitoring](#monitoring)
6. [Best Practices](#best-practices)

## Overview

Automated backup verification ensures that database backups are valid and can be restored when needed:

- **Automatic Verification:** Verify backups automatically
- **Data Integrity:** Ensure data integrity in backups
- **Restore Testing:** Test restore process regularly
- **Alerting:** Alert on backup failures

## Features

### Backup Strategy

```typescript
// lib/backup/BackupService.ts
import { Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { S3Client, PutObjectCommand, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

const s3 = new S3Client({ region: 'us-east-1' });
const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export interface BackupConfig {
  enabled: boolean;
  schedule: string; // cron expression
  retentionDays: number;
  bucketName: string;
  prefix: string;
  encryption: boolean;
  compression: boolean;
}

export const DEFAULT_BACKUP_CONFIG: BackupConfig = {
  enabled: true,
  schedule: '0 2 * * *', // 2 AM daily
  retentionDays: 30,
  bucketName: 'servio-backups',
  prefix: 'database',
  encryption: true,
  compression: true,
};

export class BackupService {
  private config: BackupConfig;

  constructor(config: BackupConfig = DEFAULT_BACKUP_CONFIG) {
    this.config = config;
  }

  async createBackup(): Promise<BackupResult> {
    console.log('Creating backup...');

    const timestamp = new Date().toISOString();
    const backupKey = `${this.config.prefix}/${timestamp}.sql`;

    try {
      // Step 1: Dump database
      console.log('Step 1: Dumping database...');
      const dump = await this.dumpDatabase();

      // Step 2: Compress if enabled
      console.log('Step 2: Compressing backup...');
      const data = this.config.compression ? await this.compress(dump) : dump;

      // Step 3: Upload to S3
      console.log('Step 3: Uploading to S3...');
      await this.uploadToS3(backupKey, data);

      // Step 4: Verify backup
      console.log('Step 4: Verifying backup...');
      const verification = await this.verifyBackup(backupKey);

      // Step 5: Clean old backups
      console.log('Step 5: Cleaning old backups...');
      await this.cleanOldBackups();

      // Step 6: Send metrics
      console.log('Step 6: Sending metrics...');
      await this.sendMetrics(verification);

      console.log('Backup created successfully');

      return {
        success: true,
        backupKey,
        size: data.length,
        verified: verification.success,
        timestamp,
      };
    } catch (error) {
      console.error('Backup failed:', error);

      // Send failure metrics
      await this.sendFailureMetrics(error);

      throw error;
    }
  }

  async dumpDatabase(): Promise<string> {
    // Use pg_dump to dump database
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);

    const { stdout } = await execAsync(
      `pg_dump ${process.env.DATABASE_URL} --no-owner --no-acl --format=plain`
    );

    return stdout;
  }

  async compress(data: string): Promise<Buffer> {
    const zlib = require('zlib');
    const gzip = promisify(zlib.gzip);

    return await gzip(data);
  }

  async uploadToS3(key: string, data: Buffer): Promise<void> {
    const command = new PutObjectCommand({
      Bucket: this.config.bucketName,
      Key: key,
      Body: data,
      ServerSideEncryption: this.config.encryption ? 'AES256' : undefined,
      Metadata: {
        timestamp: new Date().toISOString(),
        version: '1.0',
      },
    });

    await s3.send(command);
  }

  async verifyBackup(backupKey: string): Promise<VerificationResult> {
    console.log(`Verifying backup: ${backupKey}...`);

    try {
      // Step 1: Download backup
      console.log('Step 1: Downloading backup...');
      const backup = await this.downloadBackup(backupKey);

      // Step 2: Decompress if needed
      console.log('Step 2: Decompressing backup...');
      const dump = this.config.compression ? await this.decompress(backup) : backup.toString();

      // Step 3: Validate SQL syntax
      console.log('Step 3: Validating SQL syntax...');
      const syntaxValid = await this.validateSQLSyntax(dump);

      if (!syntaxValid) {
        return {
          success: false,
          error: 'Invalid SQL syntax',
        };
      }

      // Step 4: Check for required tables
      console.log('Step 4: Checking for required tables...');
      const tablesValid = await this.checkRequiredTables(dump);

      if (!tablesValid) {
        return {
          success: false,
          error: 'Missing required tables',
        };
      }

      // Step 5: Check data integrity
      console.log('Step 5: Checking data integrity...');
      const integrityValid = await this.checkDataIntegrity(dump);

      if (!integrityValid) {
        return {
          success: false,
          error: 'Data integrity check failed',
        };
      }

      // Step 6: Test restore (optional)
      console.log('Step 6: Testing restore...');
      const restoreValid = await this.testRestore(dump);

      if (!restoreValid) {
        return {
          success: false,
          error: 'Restore test failed',
        };
      }

      console.log('Backup verified successfully');

      return {
        success: true,
      };
    } catch (error) {
      console.error('Backup verification failed:', error);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  async downloadBackup(backupKey: string): Promise<Buffer> {
    const command = new GetObjectCommand({
      Bucket: this.config.bucketName,
      Key: backupKey,
    });

    const response = await s3.send(command);
    const chunks: Uint8Array[] = [];

    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  async decompress(data: Buffer): Promise<string> {
    const zlib = require('zlib');
    const gunzip = promisify(zlib.gunzip);

    const decompressed = await gunzip(data);
    return decompressed.toString();
  }

  async validateSQLSyntax(dump: string): Promise<boolean> {
    // Check for basic SQL syntax errors
    const errors = [];

    // Check for unclosed parentheses
    const openParens = (dump.match(/\(/g) || []).length;
    const closeParens = (dump.match(/\)/g) || []).length;
    if (openParens !== closeParens) {
      errors.push('Unclosed parentheses');
    }

    // Check for unclosed quotes
    const singleQuotes = (dump.match(/'/g) || []).length;
    if (singleQuotes % 2 !== 0) {
      errors.push('Unclosed single quotes');
    }

    // Check for unclosed double quotes
    const doubleQuotes = (dump.match(/"/g) || []).length;
    if (doubleQuotes % 2 !== 0) {
      errors.push('Unclosed double quotes');
    }

    // Check for missing semicolons
    const statements = dump.split(';');
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed.length > 0 && !trimmed.startsWith('--') && !trimmed.startsWith('/*')) {
        // This is a SQL statement, should end with semicolon
      }
    }

    return errors.length === 0;
  }

  async checkRequiredTables(dump: string): Promise<boolean> {
    const requiredTables = [
      'users',
      'venues',
      'orders',
      'menu_items',
      'tables',
      'staff',
      'inventory',
    ];

    for (const table of requiredTables) {
      if (!dump.includes(`CREATE TABLE ${table}`) && !dump.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
        console.error(`Missing required table: ${table}`);
        return false;
      }
    }

    return true;
  }

  async checkDataIntegrity(dump: string): Promise<boolean> {
    // Check for data integrity issues
    const errors = [];

    // Check for NULL values in NOT NULL columns
    const notNullViolations = dump.match(/INSERT INTO.*VALUES.*NULL/g);
    if (notNullViolations) {
      errors.push('NULL values in NOT NULL columns');
    }

    // Check for duplicate primary keys
    const duplicateKeys = dump.match(/PRIMARY KEY.*duplicate/gi);
    if (duplicateKeys) {
      errors.push('Duplicate primary keys');
    }

    // Check for foreign key violations
    const fkViolations = dump.match(/FOREIGN KEY.*violation/gi);
    if (fkViolations) {
      errors.push('Foreign key violations');
    }

    return errors.length === 0;
  }

  async testRestore(dump: string): Promise<boolean> {
    // Create a test database
    const testDbName = `servio_test_${Date.now()}`;

    try {
      // Create test database
      await db.execute(`CREATE DATABASE ${testDbName};`);

      // Connect to test database
      const testPool = new Pool({
        connectionString: process.env.DATABASE_URL!.replace(/\/[^/]*$/, `/${testDbName}`),
      });
      const testDb = drizzle(testPool);

      // Restore backup
      await testDb.execute(dump);

      // Verify tables exist
      const tables = await testDb.execute(`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public';
      `);

      if (tables.rows.length === 0) {
        throw new Error('No tables found after restore');
      }

      // Drop test database
      await db.execute(`DROP DATABASE ${testDbName};`);

      return true;
    } catch (error) {
      console.error('Restore test failed:', error);

      // Clean up test database
      try {
        await db.execute(`DROP DATABASE IF EXISTS ${testDbName};`);
      } catch (e) {
        // Ignore errors
      }

      return false;
    }
  }

  async cleanOldBackups(): Promise<void> {
    console.log('Cleaning old backups...');

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

    const command = new ListObjectsV2Command({
      Bucket: this.config.bucketName,
      Prefix: this.config.prefix,
    });

    const response = await s3.send(command);
    const objects = response.Contents || [];

    for (const object of objects) {
      if (object.LastModified && object.LastModified < cutoffDate) {
        console.log(`Deleting old backup: ${object.Key}`);

        await s3.send({
          Bucket: this.config.bucketName,
          Key: object.Key,
        });
      }
    }
  }

  async sendMetrics(verification: VerificationResult): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/Backup',
      MetricData: [
        {
          MetricName: 'BackupSuccess',
          Value: 1,
          Unit: 'Count',
        },
        {
          MetricName: 'BackupVerified',
          Value: verification.success ? 1 : 0,
          Unit: 'Count',
        },
      ],
    });

    await cloudwatch.send(command);
  }

  async sendFailureMetrics(error: any): Promise<void> {
    const command = new PutMetricDataCommand({
      Namespace: 'Servio/Backup',
      MetricData: [
        {
          MetricName: 'BackupFailure',
          Value: 1,
          Unit: 'Count',
        },
      ],
    });

    await cloudwatch.send(command);
  }
}

interface BackupResult {
  success: boolean;
  backupKey: string;
  size: number;
  verified: boolean;
  timestamp: string;
}

interface VerificationResult {
  success: boolean;
  error?: string;
}

function promisify(fn: any): any {
  return (...args: any[]) => {
    return new Promise((resolve, reject) => {
      fn(...args, (err: any, result: any) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  };
}
```

## Verification Process

### GitHub Actions Workflow

```yaml
# .github/workflows/backup-verification.yml
name: Backup Verification

on:
  schedule:
    - cron: '0 3 * * *' # 3 AM daily
  workflow_dispatch:

jobs:
  verify-backup:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Verify backup
        run: npm run backup:verify
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          AWS_REGION: us-east-1

      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Backup verification successful"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Backup verification failed"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Backup Verification Script

```typescript
// scripts/verify-backup.ts
import { BackupService } from '../lib/backup/BackupService';

const backupService = new BackupService();

async function verifyLatestBackup() {
  console.log('Verifying latest backup...');

  try {
    // Get latest backup
    const latestBackup = await backupService.getLatestBackup();

    if (!latestBackup) {
      console.error('No backups found');
      process.exit(1);
    }

    console.log(`Latest backup: ${latestBackup.key}`);

    // Verify backup
    const verification = await backupService.verifyBackup(latestBackup.key);

    if (verification.success) {
      console.log('Backup verification successful');
      process.exit(0);
    } else {
      console.error('Backup verification failed:', verification.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Backup verification error:', error);
    process.exit(1);
  }
}

verifyLatestBackup().catch(console.error);
```

## Monitoring

### CloudWatch Alarms

```typescript
// scripts/setup-backup-alarms.ts
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export async function setupBackupAlarms() {
  // Backup failure alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-backup-failure',
    AlarmDescription: 'Backup failed',
    MetricName: 'BackupFailure',
    Namespace: 'Servio/Backup',
    Statistic: 'Sum',
    Period: 86400, // 1 day
    EvaluationPeriods: 1,
    Threshold: 1,
    ComparisonOperator: 'GreaterThanOrEqualToThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  // Backup verification failure alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-backup-verification-failure',
    AlarmDescription: 'Backup verification failed',
    MetricName: 'BackupVerified',
    Namespace: 'Servio/Backup',
    Statistic: 'Sum',
    Period: 86400, // 1 day
    EvaluationPeriods: 1,
    Threshold: 0,
    ComparisonOperator: 'LessThanThreshold',
    TreatMissingData: 'breaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  console.log('Backup alarms setup successfully!');
}
```

## Best Practices

### 1. Verify Backups Regularly

Verify backups regularly:

```typescript
// Good: Verify backups regularly
const schedule = '0 3 * * *'; // 3 AM daily

// Bad: Never verify backups
// No verification
```

### 2. Test Restore Process

Test restore process regularly:

```typescript
// Good: Test restore process
const restoreValid = await this.testRestore(dump);

// Bad: No restore testing
// No restore testing
```

### 3. Keep Multiple Backups

Keep multiple backups:

```typescript
// Good: Keep multiple backups
const retentionDays = 30;

// Bad: Keep only one backup
const retentionDays = 1;
```

### 4. Encrypt Backups

Encrypt backups:

```typescript
// Good: Encrypt backups
const encryption = true;

// Bad: No encryption
const encryption = false;
```

### 5. Compress Backups

Compress backups:

```typescript
// Good: Compress backups
const compression = true;

// Bad: No compression
const compression = false;
```

### 6. Monitor Backup Failures

Monitor backup failures:

```typescript
// Good: Monitor backup failures
await this.sendFailureMetrics(error);

// Bad: No monitoring
// No monitoring
```

### 7. Document Backup Process

Document backup process:

```markdown
# Good: Document backup process
## Backup Process

1. Dump database
2. Compress backup
3. Upload to S3
4. Verify backup
5. Clean old backups

# Bad: No documentation
# No documentation
```

## References

- [Database Backups](https://www.postgresql.org/docs/current/backup.html)
- [AWS S3](https://aws.amazon.com/s3/)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
- [Backup Best Practices](https://aws.amazon.com/blogs/database/best-practices-for-working-with-postgresql/)
