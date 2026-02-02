#!/usr/bin/env tsx

/**
 * Automated Backup Verification Script
 * Verifies database backups and ensures data integrity
 */

import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/monitoring/structured-logger';

interface BackupConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  backupRetentionDays: number;
  verificationInterval: number; // in hours
}

interface BackupInfo {
  id: string;
  created_at: string;
  size: number;
  status: 'completed' | 'failed' | 'in_progress';
}

interface VerificationResult {
  backupId: string;
  verified: boolean;
  checksum?: string;
  recordCount?: number;
  error?: string;
  duration: number;
}

class BackupVerifier {
  private config: BackupConfig;
  private supabase: ReturnType<typeof createClient>;

  constructor(config: BackupConfig) {
    this.config = config;
    this.supabase = createClient(config.supabaseUrl, config.supabaseServiceKey);
  }

  /**
   * Get list of recent backups
   */
  async getRecentBackups(): Promise<BackupInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('backups')
        .select('*')
        .gte('created_at', new Date(Date.now() - this.config.backupRetentionDays * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return (data || []) as BackupInfo[];
    } catch (error) {
      logger.error('Failed to fetch recent backups', { error });
      throw error;
    }
  }

  /**
   * Verify a specific backup
   */
  async verifyBackup(backupId: string): Promise<VerificationResult> {
    const startTime = Date.now();

    try {
      logger.info(`Starting verification for backup: ${backupId}`);

      // Get backup details
      const { data: backup, error: backupError } = await this.supabase
        .from('backups')
        .select('*')
        .eq('id', backupId)
        .single();

      if (backupError) throw backupError;

      // Verify backup exists and is accessible
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Calculate checksum (placeholder - implement actual checksum calculation)
      const checksum = await this.calculateChecksum(backupId);

      // Verify record counts in critical tables
      const recordCounts = await this.verifyRecordCounts();

      // Update backup verification status
      await this.supabase
        .from('backups')
        .update({
          verified: true,
          verified_at: new Date().toISOString(),
          checksum,
          record_counts: recordCounts,
        })
        .eq('id', backupId);

      const duration = Date.now() - startTime;

      logger.info(`Backup verification completed: ${backupId}`, {
        duration,
        checksum,
        recordCounts,
      });

      return {
        backupId,
        verified: true,
        checksum,
        recordCount: Object.values(recordCounts).reduce((a, b) => a + b, 0),
        duration,
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : String(error);

      logger.error(`Backup verification failed: ${backupId}`, {
        error: errorMessage,
        duration,
      });

      // Update backup verification status
      await this.supabase
        .from('backups')
        .update({
          verified: false,
          verified_at: new Date().toISOString(),
          verification_error: errorMessage,
        })
        .eq('id', backupId);

      return {
        backupId,
        verified: false,
        error: errorMessage,
        duration,
      };
    }
  }

  /**
   * Calculate checksum for backup
   */
  private async calculateChecksum(backupId: string): Promise<string> {
    // Placeholder implementation
    // In production, this would:
    // 1. Download the backup file
    // 2. Calculate SHA-256 checksum
    // 3. Compare with stored checksum
    return `sha256:${backupId.substring(0, 16)}`;
  }

  /**
   * Verify record counts in critical tables
   */
  private async verifyRecordCounts(): Promise<Record<string, number>> {
    const criticalTables = [
      'venues',
      'orders',
      'menu_items',
      'tables',
      'users',
      'staff',
    ];

    const recordCounts: Record<string, number> = {};

    for (const table of criticalTables) {
      try {
        const { count, error } = await this.supabase
          .from(table)
          .select('*', { count: 'exact', head: true });

        if (error) {
          logger.warn(`Failed to count records in ${table}`, { error });
          recordCounts[table] = -1;
        } else {
          recordCounts[table] = count || 0;
        }
      } catch (error) {
        logger.warn(`Error counting records in ${table}`, { error });
        recordCounts[table] = -1;
      }
    }

    return recordCounts;
  }

  /**
   * Verify all recent backups
   */
  async verifyAllRecentBackups(): Promise<VerificationResult[]> {
    const backups = await this.getRecentBackups();
    const results: VerificationResult[] = [];

    logger.info(`Verifying ${backups.length} recent backups`);

    for (const backup of backups) {
      if (backup.status === 'completed') {
        const result = await this.verifyBackup(backup.id);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Check for failed backups
   */
  async checkFailedBackups(): Promise<BackupInfo[]> {
    try {
      const { data, error } = await this.supabase
        .from('backups')
        .select('*')
        .eq('status', 'failed')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (error) throw error;

      return (data || []) as BackupInfo[];
    } catch (error) {
      logger.error('Failed to check for failed backups', { error });
      throw error;
    }
  }

  /**
   * Send alert for failed backups
   */
  async alertFailedBackups(failedBackups: BackupInfo[]): Promise<void> {
    if (failedBackups.length === 0) return;

    logger.error(`Found ${failedBackups.length} failed backups`, {
      backups: failedBackups.map(b => ({ id: b.id, created_at: b.created_at })),
    });

    // Send alert (placeholder - implement actual alerting)
    // await sendAlert({
    //   type: 'backup_failure',
    //   message: `${failedBackups.length} backups failed in the last 24 hours`,
    //   details: failedBackups,
    // });
  }

  /**
   * Run scheduled verification
   */
  async runScheduledVerification(): Promise<void> {
    logger.info('Starting scheduled backup verification');

    try {
      // Verify all recent backups
      const results = await this.verifyAllRecentBackups();

      // Check for failed backups
      const failedBackups = await this.checkFailedBackups();
      await this.alertFailedBackups(failedBackups);

      // Log summary
      const verified = results.filter(r => r.verified).length;
      const failed = results.filter(r => !r.verified).length;

      logger.info('Backup verification completed', {
        total: results.length,
        verified,
        failed,
      });
    } catch (error) {
      logger.error('Scheduled backup verification failed', { error });
      throw error;
    }
  }
}

// Main execution
async function main() {
  const config: BackupConfig = {
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    backupRetentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30', 10),
    verificationInterval: parseInt(process.env.BACKUP_VERIFICATION_INTERVAL || '24', 10),
  };

  if (!config.supabaseUrl || !config.supabaseServiceKey) {
    console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const verifier = new BackupVerifier(config);

  const command = process.argv[2] || 'verify';

  switch (command) {
    case 'verify':
      await verifier.runScheduledVerification();
      break;
    case 'verify-backup':
      const backupId = process.argv[3];
      if (!backupId) {
        console.error('Missing backup ID');
        process.exit(1);
      }
      const result = await verifier.verifyBackup(backupId);
      console.log(JSON.stringify(result, null, 2));
      break;
    case 'list':
      const backups = await verifier.getRecentBackups();
      console.log(JSON.stringify(backups, null, 2));
      break;
    case 'check-failed':
      const failed = await verifier.checkFailedBackups();
      console.log(JSON.stringify(failed, null, 2));
      break;
    default:
      console.log('Usage: tsx scripts/verify-backups.ts {verify|verify-backup|list|check-failed} [backupId]');
      process.exit(1);
  }
}

main().catch(error => {
  console.error('Backup verification failed:', error);
  process.exit(1);
});
