# Automated Rollback on Deployment Failures

This document describes the implementation of automated rollback on deployment failures for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Rollback Triggers](#rollback-triggers)
5. [Rollback Process](#rollback-process)
6. [Monitoring](#monitoring)
7. [Best Practices](#best-practices)

## Overview

Automated rollback is a critical feature that ensures system stability by automatically reverting deployments when failures are detected:

- **Automatic Detection:** Detect failures automatically
- **Quick Rollback:** Rollback quickly to minimize downtime
- **Multiple Triggers:** Support multiple rollback triggers
- **Notification:** Notify team of rollback events

## Features

### Rollback Triggers

```typescript
// lib/rollback/triggers.ts
export interface RollbackTrigger {
  type: 'error-rate' | 'response-time' | 'health-check' | 'manual' | 'alarm';
  threshold?: number;
  duration?: number;
  message: string;
}

export interface RollbackConfig {
  enabled: boolean;
  triggers: RollbackTrigger[];
  cooldownPeriod: number; // seconds
  maxRollbacks: number;
  notificationChannels: string[];
}

export const DEFAULT_ROLLBACK_CONFIG: RollbackConfig = {
  enabled: true,
  triggers: [
    {
      type: 'error-rate',
      threshold: 0.05, // 5% error rate
      duration: 60, // 1 minute
      message: 'Error rate exceeded threshold',
    },
    {
      type: 'response-time',
      threshold: 1000, // 1 second
      duration: 60, // 1 minute
      message: 'Response time exceeded threshold',
    },
    {
      type: 'health-check',
      threshold: 3, // 3 failed health checks
      duration: 60, // 1 minute
      message: 'Health check failed',
    },
  ],
  cooldownPeriod: 300, // 5 minutes
  maxRollbacks: 3,
  notificationChannels: ['slack', 'email'],
};
```

### Rollback Service

```typescript
// lib/rollback/RollbackService.ts
import { ECSClient } from '@aws-sdk/client-ecs';
import { ELBv2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { SNSClient } from '@aws-sdk/client-sns';

const ecs = new ECSClient({ region: 'us-east-1' });
const elb = new ELBv2Client({ region: 'us-east-1' });
const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });
const sns = new SNSClient({ region: 'us-east-1' });

export class RollbackService {
  private config: RollbackConfig;
  private rollbackCount = 0;
  private lastRollbackTime: Date | null = null;

  constructor(config: RollbackConfig = DEFAULT_ROLLBACK_CONFIG) {
    this.config = config;
  }

  async checkRollbackConditions(): Promise<boolean> {
    if (!this.config.enabled) {
      return false;
    }

    // Check cooldown period
    if (this.lastRollbackTime) {
      const timeSinceLastRollback = (Date.now() - this.lastRollbackTime.getTime()) / 1000;
      if (timeSinceLastRollback < this.config.cooldownPeriod) {
        console.log('Rollback cooldown period active');
        return false;
      }
    }

    // Check max rollbacks
    if (this.rollbackCount >= this.config.maxRollbacks) {
      console.log('Max rollbacks reached');
      return false;
    }

    // Check each trigger
    for (const trigger of this.config.triggers) {
      const shouldRollback = await this.checkTrigger(trigger);
      if (shouldRollback) {
        console.log(`Rollback trigger activated: ${trigger.type}`);
        return true;
      }
    }

    return false;
  }

  async checkTrigger(trigger: RollbackTrigger): Promise<boolean> {
    switch (trigger.type) {
      case 'error-rate':
        return this.checkErrorRate(trigger);
      case 'response-time':
        return this.checkResponseTime(trigger);
      case 'health-check':
        return this.checkHealthCheck(trigger);
      case 'manual':
        return true;
      case 'alarm':
        return this.checkAlarm(trigger);
      default:
        return false;
    }
  }

  async checkErrorRate(trigger: RollbackTrigger): Promise<boolean> {
    const metrics = await this.getMetrics('ErrorRate', trigger.duration || 60);

    if (metrics.average > (trigger.threshold || 0.05)) {
      console.log(`Error rate ${metrics.average} exceeded threshold ${trigger.threshold}`);
      return true;
    }

    return false;
  }

  async checkResponseTime(trigger: RollbackTrigger): Promise<boolean> {
    const metrics = await this.getMetrics('ResponseTime', trigger.duration || 60);

    if (metrics.average > (trigger.threshold || 1000)) {
      console.log(`Response time ${metrics.average} exceeded threshold ${trigger.threshold}`);
      return true;
    }

    return false;
  }

  async checkHealthCheck(trigger: RollbackTrigger): Promise<boolean> {
    const healthCheck = await this.getHealthCheck();

    if (healthCheck.failedCount >= (trigger.threshold || 3)) {
      console.log(`Health check failed ${healthCheck.failedCount} times`);
      return true;
    }

    return false;
  }

  async checkAlarm(trigger: RollbackTrigger): Promise<boolean> {
    const alarm = await cloudwatch.describeAlarms({
      AlarmNames: [trigger.message],
    }).promise();

    return alarm.MetricAlarms?.[0]?.StateValue === 'ALARM';
  }

  async executeRollback(trigger: RollbackTrigger): Promise<void> {
    console.log('Executing rollback...');

    try {
      // Step 1: Get previous stable deployment
      const previousDeployment = await this.getPreviousDeployment();

      // Step 2: Rollback to previous deployment
      await this.rollbackToDeployment(previousDeployment);

      // Step 3: Verify rollback
      await this.verifyRollback();

      // Step 4: Update rollback count
      this.rollbackCount++;
      this.lastRollbackTime = new Date();

      // Step 5: Notify team
      await this.notifyRollback(trigger, previousDeployment);

      console.log('Rollback completed successfully');
    } catch (error) {
      console.error('Rollback failed:', error);
      throw error;
    }
  }

  async getPreviousDeployment(): Promise<Deployment> {
    // Get previous stable deployment from ECS
    const services = await ecs.describeServices({
      services: ['servio-production'],
      cluster: 'servio-production',
    }).promise();

    const service = services.services![0];
    const taskDefinition = await ecs.describeTaskDefinition({
      taskDefinition: service!.TaskDefinition!,
    }).promise();

    return {
      taskDefinition: taskDefinition.taskDefinition!,
      image: taskDefinition.taskDefinition!.containerDefinitions![0].image!,
      createdAt: new Date(taskDefinition.taskDefinition!.revision!),
    };
  }

  async rollbackToDeployment(deployment: Deployment): Promise<void> {
    // Update task definition to previous version
    await ecs.registerTaskDefinition({
      family: 'servio-production',
      containerDefinitions: deployment.taskDefinition.containerDefinitions,
    }).promise();

    // Force new deployment
    await ecs.updateService({
      service: 'servio-production',
      cluster: 'servio-production',
      forceNewDeployment: true,
    }).promise();

    // Wait for deployment to complete
    await this.waitForDeployment();
  }

  async verifyRollback(): Promise<void> {
    const maxAttempts = 60;
    const interval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      const healthCheck = await this.getHealthCheck();

      if (healthCheck.status === 'healthy') {
        console.log('Rollback verified successfully');
        return;
      }

      console.log(`Waiting for rollback verification... (${i + 1}/${maxAttempts})`);
      await sleep(interval);
    }

    throw new Error('Rollback verification failed');
  }

  async notifyRollback(trigger: RollbackTrigger, deployment: Deployment): Promise<void> {
    const message = {
      text: `🚨 Rollback executed`,
      attachments: [
        {
          color: 'danger',
          fields: [
            {
              title: 'Trigger',
              value: trigger.type,
              short: true,
            },
            {
              title: 'Message',
              value: trigger.message,
              short: true,
            },
            {
              title: 'Previous Deployment',
              value: deployment.image,
              short: true,
            },
            {
              title: 'Rollback Count',
              value: this.rollbackCount.toString(),
              short: true,
            },
          ],
        },
      ],
    };

    // Send to Slack
    if (this.config.notificationChannels.includes('slack')) {
      await this.sendSlackNotification(message);
    }

    // Send to email
    if (this.config.notificationChannels.includes('email')) {
      await this.sendEmailNotification(message);
    }
  }

  async sendSlackNotification(message: any): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;

    if (!webhookUrl) {
      console.warn('Slack webhook URL not configured');
      return;
    }

    await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });
  }

  async sendEmailNotification(message: any): Promise<void> {
    // Send email notification
    console.log('Email notification:', message);
  }

  async getMetrics(metricName: string, duration: number): Promise<MetricData> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - duration * 1000);

    const response = await cloudwatch.getMetricStatistics({
      Namespace: 'Servio/Production',
      MetricName: metricName,
      Dimensions: [
        {
          Name: 'Service',
          Value: 'servio-production',
        },
      ],
      StartTime: startTime,
      EndTime: endTime,
      Period: 60,
      Statistics: ['Average', 'Sum', 'SampleCount'],
    }).promise();

    const datapoints = response.Datapoints || [];

    if (datapoints.length === 0) {
      return {
        average: 0,
        sum: 0,
        count: 0,
      };
    }

    return {
      average: datapoints.reduce((sum, dp) => sum + (dp.Average || 0), 0) / datapoints.length,
      sum: datapoints.reduce((sum, dp) => sum + (dp.Sum || 0), 0),
      count: datapoints.reduce((sum, dp) => sum + (dp.SampleCount || 0), 0),
    };
  }

  async getHealthCheck(): Promise<HealthCheck> {
    const response = await fetch('https://api.servio.com/health');

    if (response.ok) {
      return {
        status: 'healthy',
        failedCount: 0,
      };
    }

    return {
      status: 'unhealthy',
      failedCount: 1,
    };
  }

  async waitForDeployment(): Promise<void> {
    const maxAttempts = 60;
    const interval = 5000; // 5 seconds

    for (let i = 0; i < maxAttempts; i++) {
      const services = await ecs.describeServices({
        services: ['servio-production'],
        cluster: 'servio-production',
      }).promise();

      const service = services.services![0];

      if (service!.deployments![0].rolloutState === 'COMPLETED') {
        console.log('Deployment completed');
        return;
      }

      console.log(`Waiting for deployment... (${i + 1}/${maxAttempts})`);
      await sleep(interval);
    }

    throw new Error('Deployment did not complete');
  }

  resetRollbackCount(): void {
    this.rollbackCount = 0;
    this.lastRollbackTime = null;
  }
}

interface Deployment {
  taskDefinition: any;
  image: string;
  createdAt: Date;
}

interface MetricData {
  average: number;
  sum: number;
  count: number;
}

interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  failedCount: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Rollback Process

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-with-rollback.yml
name: Deploy with Rollback

on:
  push:
    branches: [main]

jobs:
  deploy:
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

      - name: Run tests
        run: npm test

      - name: Build Docker image
        run: |
          docker build -t servio-app:${{ github.sha }} .
          docker tag servio-app:${{ github.sha }} ${ECR_REGISTRY}/servio-app:${{ github.sha }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2
        with:
          mask-password: 'true'

      - name: Push to ECR
        run: docker push ${ECR_REGISTRY}/servio-app:${{ github.sha }}

      - name: Deploy to production
        run: npm run deploy:production --tag=${{ github.sha }}

      - name: Wait for deployment
        run: npm run wait:deployment

      - name: Run smoke tests
        run: npm run test:smoke

      - name: Monitor for rollback
        run: npm run monitor:rollback

      - name: Notify Slack on success
        if: success()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deployment successful: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Notify Slack on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deployment failed: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Rollback Monitor

```typescript
// scripts/monitor-rollback.ts
import { RollbackService } from '../lib/rollback/RollbackService';

const rollbackService = new RollbackService();

async function monitorRollback() {
  console.log('Starting rollback monitor...');

  const interval = 10000; // 10 seconds

  while (true) {
    try {
      const shouldRollback = await rollbackService.checkRollbackConditions();

      if (shouldRollback) {
        console.log('Rollback conditions met, executing rollback...');

        const trigger = rollbackService.config.triggers[0];
        await rollbackService.executeRollback(trigger);

        console.log('Rollback completed');
        break;
      }

      console.log('No rollback conditions met');
    } catch (error) {
      console.error('Error monitoring rollback:', error);
    }

    await sleep(interval);
  }
}

monitorRollback().catch(console.error);
```

## Monitoring

### CloudWatch Alarms

```typescript
// scripts/setup-rollback-alarms.ts
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export async function setupRollbackAlarms() {
  // Error rate alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-production-error-rate',
    AlarmDescription: 'Production error rate exceeds threshold',
    MetricName: 'ErrorRate',
    Namespace: 'Servio/Production',
    Statistic: 'Average',
    Period: 60,
    EvaluationPeriods: 1,
    Threshold: 0.05, // 5% error rate
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  // Response time alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-production-response-time',
    AlarmDescription: 'Production response time exceeds threshold',
    MetricName: 'ResponseTime',
    Namespace: 'Servio/Production',
    Statistic: 'Average',
    Period: 60,
    EvaluationPeriods: 1,
    Threshold: 1000, // 1 second
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  // Health check alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-production-health-check',
    AlarmDescription: 'Production health check failed',
    MetricName: 'HealthCheck',
    Namespace: 'Servio/Production',
    Statistic: 'Sum',
    Period: 60,
    EvaluationPeriods: 1,
    Threshold: 3, // 3 failed health checks
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  console.log('Rollback alarms setup successfully!');
}
```

## Best Practices

### 1. Set Appropriate Thresholds

Set appropriate thresholds for rollback:

```typescript
// Good: Appropriate thresholds
const ERROR_RATE_THRESHOLD = 0.05; // 5%
const RESPONSE_TIME_THRESHOLD = 1000; // 1 second
const HEALTH_CHECK_THRESHOLD = 3; // 3 failed health checks

// Bad: Too high thresholds
const ERROR_RATE_THRESHOLD = 0.5; // 50% - too high
const RESPONSE_TIME_THRESHOLD = 10000; // 10 seconds - too high
```

### 2. Use Cooldown Period

Use cooldown period to prevent rollback loops:

```typescript
// Good: Use cooldown period
const COOLDOWN_PERIOD = 300; // 5 minutes

if (timeSinceLastRollback < COOLDOWN_PERIOD) {
  console.log('Rollback cooldown period active');
  return false;
}

// Bad: No cooldown period
// No cooldown period
```

### 3. Limit Max Rollbacks

Limit max rollbacks to prevent infinite loops:

```typescript
// Good: Limit max rollbacks
const MAX_ROLLBACKS = 3;

if (rollbackCount >= MAX_ROLLBACKS) {
  console.log('Max rollbacks reached');
  return false;
}

// Bad: No max rollbacks
// No max rollbacks
```

### 4. Notify Team

Notify team of rollback events:

```typescript
// Good: Notify team
await this.notifyRollback(trigger, previousDeployment);

// Bad: No notification
// No notification
```

### 5. Verify Rollback

Verify rollback after execution:

```typescript
// Good: Verify rollback
await this.verifyRollback();

// Bad: No verification
// No verification
```

### 6. Document Rollback Process

Document rollback process:

```markdown
# Good: Document rollback process
## Rollback Process

1. Check rollback conditions
2. Execute rollback
3. Verify rollback
4. Notify team

# Bad: No documentation
# No documentation
```

### 7. Test Rollback

Test rollback process:

```bash
# Good: Test rollback
# Test rollback in staging
npm run test:rollback:staging

# Bad: No testing
# No testing
```

## References

- [Automated Rollback](https://martinfowler.com/bliki/CanaryRelease)
- [AWS ECS](https://aws.amazon.com/ecs/)
- [Deployment Strategies](https://www.nginx.com/blog/deployment-strategies/)
- [CloudWatch Alarms](https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html)
