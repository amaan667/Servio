# Canary Deployment Support

This document describes the implementation of canary deployment support for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Deployment Process](#deployment-process)
5. [Monitoring](#monitoring)
6. [Best Practices](#best-practices)

## Overview

Canary deployment is a technique that reduces risk by rolling out new features to a small subset of users before full deployment:

- **Gradual Rollout:** Deploy to small percentage of users first
- **Risk Mitigation:** Detect issues before affecting all users
- **Quick Rollback:** Easy to rollback if issues occur
- **A/B Testing:** Can be used for A/B testing

## Features

### Infrastructure Setup

```yaml
# terraform/canary/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = "us-east-1"
}

# Canary ECS Service
resource "aws_ecs_service" "canary" {
  name            = "servio-canary"
  cluster         = aws_ecs_cluster.production.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1 # Start with 1 instance
  launch_type    = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.canary.arn
    container_name   = "app"
    container_port   = 3000
  }

  tags = {
    Name        = "servio-canary"
    Environment = "production"
    Deployment  = "canary"
  }
}

# Canary Target Group
resource "aws_lb_target_group" "canary" {
  name        = "servio-canary-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.production.id
  target_type = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
  }

  tags = {
    Name        = "servio-canary-tg"
    Environment = "production"
    Deployment  = "canary"
  }
}

# Load Balancer Listener with Canary
resource "aws_lb_listener" "production" {
  load_balancer_arn = aws_lb.production.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.production.arn
    forward_config {
      target_group {
        stickiness {
          enabled = true
          duration = 3600 # 1 hour
        }
      }
    }
  }

  certificate_arn = var.production_ssl_certificate_arn
}
```

### Canary Deployment Script

```typescript
// scripts/canary-deploy.ts
import { ECSClient } from '@aws-sdk/client-ecs';
import { ELBv2Client } from '@aws-sdk/client-elastic-load-balancing-v2';

const ecs = new ECSClient({ region: 'us-east-1' });
const elb = new ELBv2Client({ region: 'us-east-1' });

const CANARY_SERVICE = 'servio-canary';
const CANARY_TG = 'servio-canary-tg';
const LISTENER_ARN = process.env.LISTENER_ARN!;
const CANARY_PERCENTAGE = 5; // Start with 5%

export async function deployCanary(imageTag: string) {
  console.log('Starting canary deployment...');

  // Step 1: Update Canary task definition
  console.log('Step 1: Updating Canary task definition...');
  await updateTaskDefinition('canary', imageTag);

  // Step 2: Scale up Canary service
  console.log('Step 2: Scaling up Canary service...');
  await scaleService(CANARY_SERVICE, 1);

  // Step 3: Wait for Canary to be healthy
  console.log('Step 3: Waiting for Canary to be healthy...');
  await waitForServiceHealth(CANARY_SERVICE);

  // Step 4: Configure traffic routing
  console.log('Step 4: Configuring traffic routing...');
  await configureCanaryTraffic(CANARY_PERCENTAGE);

  // Step 5: Monitor Canary metrics
  console.log('Step 5: Monitoring Canary metrics...');
  await monitorCanaryMetrics();

  console.log('Canary deployment completed successfully!');
}

export async function scaleCanary(percentage: number) {
  console.log(`Scaling canary to ${percentage}%...`);

  // Calculate desired count based on percentage
  const totalInstances = 3; // Production instances
  const canaryInstances = Math.ceil(totalInstances * (percentage / 100));

  await scaleService(CANARY_SERVICE, canaryInstances);

  console.log(`Canary scaled to ${canaryInstances} instances`);
}

export async function promoteCanary() {
  console.log('Promoting canary to production...');

  // Step 1: Scale up Canary to full capacity
  console.log('Step 1: Scaling up Canary to full capacity...');
  await scaleService(CANARY_SERVICE, 3);

  // Step 2: Wait for Canary to be healthy
  console.log('Step 2: Waiting for Canary to be healthy...');
  await waitForServiceHealth(CANARY_SERVICE);

  // Step 3: Switch all traffic to Canary
  console.log('Step 3: Switching all traffic to Canary...');
  await configureCanaryTraffic(100);

  // Step 4: Update Production task definition
  console.log('Step 4: Updating Production task definition...');
  await updateTaskDefinition('production', process.env.CANARY_IMAGE_TAG!);

  // Step 5: Scale down old Production
  console.log('Step 5: Scaling down old Production...');
  await scaleService('servio-production', 0);

  console.log('Canary promoted to production successfully!');
}

export async function rollbackCanary() {
  console.log('Rolling back canary...');

  // Step 1: Switch all traffic back to Production
  console.log('Step 1: Switching all traffic back to Production...');
  await configureCanaryTraffic(0);

  // Step 2: Scale down Canary
  console.log('Step 2: Scaling down Canary...');
  await scaleService(CANARY_SERVICE, 0);

  console.log('Canary rolled back successfully!');
}

async function updateTaskDefinition(color: 'canary' | 'production', imageTag: string) {
  const taskDefinition = await ecs.describeTaskDefinition({
    taskDefinition: `servio-${color}`,
  }).promise();

  const newTaskDefinition = {
    ...taskDefinition.taskDefinition!,
    containerDefinitions: taskDefinition.taskDefinition!.containerDefinitions!.map(def => ({
      ...def,
      image: `${process.env.ECR_REGISTRY}/servio-app:${imageTag}`,
    })),
  };

  await ecs.registerTaskDefinition({
    family: `servio-${color}`,
    containerDefinitions: newTaskDefinition.containerDefinitions,
  }).promise();
}

async function scaleService(serviceName: string, desiredCount: number) {
  await ecs.updateService({
    service: serviceName,
    cluster: 'servio-production',
    desiredCount,
  }).promise();
}

async function waitForServiceHealth(serviceName: string) {
  const maxAttempts = 60;
  const interval = 5000; // 5 seconds

  for (let i = 0; i < maxAttempts; i++) {
    const services = await ecs.describeServices({
      services: [serviceName],
      cluster: 'servio-production',
    }).promise();

    const service = services.services![0];

    if (service!.deployments![0].rolloutState === 'COMPLETED') {
      console.log(`Service ${serviceName} is healthy`);
      return;
    }

    console.log(`Waiting for ${serviceName} to be healthy... (${i + 1}/${maxAttempts})`);
    await sleep(interval);
  }

  throw new Error(`Service ${serviceName} did not become healthy`);
}

async function configureCanaryTraffic(canaryPercentage: number) {
  await elb.modifyListener({
    ListenerArn: LISTENER_ARN,
    DefaultActions: [
      {
        Type: 'forward',
        TargetGroupArn: aws_lb_target_group.production.arn,
        ForwardConfig: {
          TargetGroups: [
            {
              TargetGroupArn: aws_lb_target_group.canary.arn,
              Weight: canaryPercentage,
            },
            {
              TargetGroupArn: aws_lb_target_group.production.arn,
              Weight: 100 - canaryPercentage,
            },
          ],
        },
      },
    ],
  }).promise();

  console.log(`Traffic configured: ${canaryPercentage}% to canary, ${100 - canaryPercentage}% to production`);
}

async function monitorCanaryMetrics() {
  const duration = 300000; // 5 minutes
  const interval = 10000; // 10 seconds

  for (let i = 0; i < duration / interval; i++) {
    const metrics = await getCanaryMetrics();

    console.log(`Canary metrics (${i + 1}/${duration / interval}):`, metrics);

    // Check error rate
    if (metrics.errorRate > 0.05) { // 5% error rate
      console.error('Error rate exceeded threshold, initiating rollback...');
      await rollbackCanary();
      return;
    }

    // Check response time
    if (metrics.responseTime > 1000) { // 1 second
      console.error('Response time exceeded threshold, initiating rollback...');
      await rollbackCanary();
      return;
    }

    await sleep(interval);
  }

  console.log('Canary metrics monitoring completed successfully!');
}

async function getCanaryMetrics() {
  // In a real implementation, this would fetch metrics from CloudWatch
  return {
    errorRate: 0.01,
    responseTime: 200,
    requestCount: 1000,
  errorCount: 10,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Deployment Process

### GitHub Actions Workflow

```yaml
# .github/workflows/canary-deploy.yml
name: Canary Deploy

on:
  workflow_dispatch:
    inputs:
      image-tag:
        description: 'Docker image tag to deploy'
        required: true
      canary-percentage:
        description: 'Percentage of traffic to route to canary (1-100)'
        required: false
        default: '5'

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
          docker build -t servio-app:${{ github.event.inputs.image-tag }} .
          docker tag servio-app:${{ github.event.inputs.image-tag }} ${ECR_REGISTRY}/servio-app:${{ github.event.inputs.image-tag }}

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2
        with:
          mask-password: 'true'

      - name: Push to ECR
        run: docker push ${ECR_REGISTRY}/servio-app:${{ github.event.inputs.image-tag }}

      - name: Deploy to Canary
        run: |
          echo "CANARY_IMAGE_TAG=${{ github.event.inputs.image-tag }}" >> $GITHUB_ENV
          npm run deploy:canary

      - name: Configure traffic
        run: |
          npm run scale:canary --percentage=${{ github.event.inputs.canary-percentage }}

      - name: Monitor canary
        run: npm run monitor:canary

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Canary deployment: ${{ github.event.inputs.image-tag }} - ${{ github.event.inputs.canary-percentage }}%"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Promote Workflow

```yaml
# .github/workflows/promote-canary.yml
name: Promote Canary

on:
  workflow_dispatch:

jobs:
  promote:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Promote canary to production
        run: npm run promote:canary

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Canary promoted to production"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Rollback Workflow

```yaml
# .github/workflows/rollback-canary.yml
name: Rollback Canary

on:
  workflow_dispatch:

jobs:
  rollback:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Rollback canary
        run: npm run rollback:canary

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Canary rolled back"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Monitoring

### CloudWatch Alarms

```typescript
// scripts/setup-canary-alarms.ts
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export async function setupCanaryAlarms() {
  // Error rate alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-canary-error-rate',
    AlarmDescription: 'Canary error rate exceeds threshold',
    MetricName: 'ErrorRate',
    Namespace: 'Servio/Canary',
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
    AlarmName: 'servio-canary-response-time',
    AlarmDescription: 'Canary response time exceeds threshold',
    MetricName: 'ResponseTime',
    Namespace: 'Servio/Canary',
    Statistic: 'Average',
    Period: 60,
    EvaluationPeriods: 1,
    Threshold: 1000, // 1 second
    ComparisonOperator: 'GreaterThanThreshold',
    TreatMissingData: 'notBreaching',
    AlarmActions: [process.env.SNS_TOPIC_ARN],
  }).promise();

  console.log('Canary alarms setup successfully!');
}
```

## Best Practices

### 1. Start Small

Start with a small percentage:

```typescript
// Good: Start with 5%
const CANARY_PERCENTAGE = 5;

// Bad: Start with 50%
const CANARY_PERCENTAGE = 50;
```

### 2. Monitor Metrics

Monitor canary metrics continuously:

```typescript
// Good: Monitor metrics
async function monitorCanaryMetrics() {
  for (let i = 0; i < duration / interval; i++) {
    const metrics = await getCanaryMetrics();
    console.log(`Canary metrics:`, metrics);

    if (metrics.errorRate > threshold) {
      await rollbackCanary();
      return;
    }

    await sleep(interval);
  }
}

// Bad: No monitoring
// No monitoring
```

### 3. Set Clear Thresholds

Set clear thresholds for rollback:

```typescript
// Good: Clear thresholds
const ERROR_RATE_THRESHOLD = 0.05; // 5%
const RESPONSE_TIME_THRESHOLD = 1000; // 1 second

if (metrics.errorRate > ERROR_RATE_THRESHOLD) {
  await rollbackCanary();
}

// Bad: No thresholds
if (metrics.errorRate > 0.1) { // 10% - too high
  await rollbackCanary();
}
```

### 4. Automate Rollback

Automate rollback on failures:

```typescript
// Good: Automated rollback
if (metrics.errorRate > threshold) {
  await rollbackCanary();
}

// Bad: Manual rollback
// No automated rollback
```

### 5. Use Feature Flags

Use feature flags to control canary:

```typescript
// Good: Use feature flags
const canaryEnabled = await getFeatureFlag('canary-deployment');

if (canaryEnabled) {
  await deployCanary(imageTag);
}

// Bad: No feature flags
// No feature flags
await deployCanary(imageTag);
```

### 6. Document Canary Process

Document canary deployment process:

```markdown
# Good: Document canary process
## Canary Deployment Process

1. Deploy to canary environment
2. Monitor canary metrics
3. Gradually increase canary percentage
4. Promote to production if metrics are good
5. Rollback if metrics are bad

# Bad: No documentation
# No documentation
```

### 7. Test Canary Deployment

Test canary deployment process:

```bash
# Good: Test canary deployment
# Run canary deployment in staging
npm run deploy:canary:staging

# Bad: No testing
# No testing
```

## References

- [Canary Deployment](https://martinfowler.com/bliki/CanaryRelease)
- [AWS ECS](https://aws.amazon.com/ecs/)
- [Deployment Strategies](https://www.nginx.com/blog/deployment-strategies/)
- [Feature Flags](https://www.launchdarkly.com/)
