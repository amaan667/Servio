# Blue-Green Deployment Strategy

This document describes the implementation of blue-green deployment strategy for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Deployment Process](#deployment-process)
5. [Rollback](#rollback)
6. [Best Practices](#best-practices)

## Overview

Blue-green deployment is a technique that reduces downtime and risk by running two identical production environments called Blue and Green:

- **Blue Environment:** Current production environment
- **Green Environment:** New version of the application
- **Switch:** Instant switch from Blue to Green
- **Rollback:** Instant switch back to Blue if issues occur

## Features

### Infrastructure Setup

```yaml
# terraform/blue-green/main.tf
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

# Blue ECS Service
resource "aws_ecs_service" "blue" {
  name            = "servio-blue"
  cluster         = aws_ecs_cluster.production.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 3
  launch_type    = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.blue.arn
    container_name   = "app"
    container_port   = 3000
  }
}

# Green ECS Service
resource "aws_ecs_service" "green" {
  name            = "servio-green"
  cluster         = aws_ecs_cluster.production.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 0 # Initially stopped
  launch_type    = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.green.arn
    container_name   = "app"
    container_port   = 3000
  }
}

# Blue Target Group
resource "aws_lb_target_group" "blue" {
  name        = "servio-blue-tg"
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
    Name = "servio-blue-tg"
    Color = "blue"
  }
}

# Green Target Group
resource "aws_lb_target_group" "green" {
  name        = "servio-green-tg"
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
    Name = "servio-green-tg"
    Color = "green"
  }
}

# Load Balancer Listener
resource "aws_lb_listener" "production" {
  load_balancer_arn = aws_lb.production.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.blue.arn # Default to blue
  }

  certificate_arn = var.production_ssl_certificate_arn
}
```

### Deployment Script

```typescript
// scripts/blue-green-deploy.ts
import { ECSClient } from '@aws-sdk/client-ecs';
import { ELBv2Client } from '@aws-sdk/client-elastic-load-balancing-v2';

const ecs = new ECSClient({ region: 'us-east-1' });
const elb = new ELBv2Client({ region: 'us-east-1' });

const BLUE_SERVICE = 'servio-blue';
const GREEN_SERVICE = 'servio-green';
const BLUE_TG = 'servio-blue-tg';
const GREEN_TG = 'servio-green-tg';
const LISTENER_ARN = process.env.LISTENER_ARN!;

export async function deployToGreen(imageTag: string) {
  console.log('Starting blue-green deployment...');

  // Step 1: Update Green task definition
  console.log('Step 1: Updating Green task definition...');
  await updateTaskDefinition('green', imageTag);

  // Step 2: Scale up Green service
  console.log('Step 2: Scaling up Green service...');
  await scaleService(GREEN_SERVICE, 3);

  // Step 3: Wait for Green to be healthy
  console.log('Step 3: Waiting for Green to be healthy...');
  await waitForServiceHealth(GREEN_SERVICE);

  // Step 4: Run smoke tests on Green
  console.log('Step 4: Running smoke tests on Green...');
  await runSmokeTests('green');

  // Step 5: Switch traffic to Green
  console.log('Step 5: Switching traffic to Green...');
  await switchTraffic('green');

  // Step 6: Wait for traffic to stabilize
  console.log('Step 6: Waiting for traffic to stabilize...');
  await sleep(30000); // 30 seconds

  // Step 7: Scale down Blue service
  console.log('Step 7: Scaling down Blue service...');
  await scaleService(BLUE_SERVICE, 0);

  console.log('Blue-green deployment completed successfully!');
}

export async function rollbackToBlue() {
  console.log('Starting rollback to Blue...');

  // Step 1: Scale up Blue service
  console.log('Step 1: Scaling up Blue service...');
  await scaleService(BLUE_SERVICE, 3);

  // Step 2: Wait for Blue to be healthy
  console.log('Step 2: Waiting for Blue to be healthy...');
  await waitForServiceHealth(BLUE_SERVICE);

  // Step 3: Switch traffic to Blue
  console.log('Step 3: Switching traffic to Blue...');
  await switchTraffic('blue');

  // Step 4: Wait for traffic to stabilize
  console.log('Step 4: Waiting for traffic to stabilize...');
  await sleep(30000); // 30 seconds

  // Step 5: Scale down Green service
  console.log('Step 5: Scaling down Green service...');
  await scaleService(GREEN_SERVICE, 0);

  console.log('Rollback to Blue completed successfully!');
}

async function updateTaskDefinition(color: 'blue' | 'green', imageTag: string) {
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

async function runSmokeTests(color: 'blue' | 'green') {
  const url = color === 'blue'
    ? 'https://blue.servio.com'
    : 'https://green.servio.com';

  const response = await fetch(`${url}/health`);

  if (!response.ok) {
    throw new Error(`Smoke tests failed for ${color}`);
  }

  console.log(`Smoke tests passed for ${color}`);
}

async function switchTraffic(color: 'blue' | 'green') {
  const targetGroupArn = color === 'blue'
    ? BLUE_TG
    : GREEN_TG;

  await elb.modifyListener({
    ListenerArn: LISTENER_ARN,
    DefaultActions: [
      {
        Type: 'forward',
        TargetGroupArn: targetGroupArn,
      },
    ],
  }).promise();

  console.log(`Traffic switched to ${color}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
```

## Deployment Process

### GitHub Actions Workflow

```yaml
# .github/workflows/blue-green-deploy.yml
name: Blue-Green Deploy

on:
  push:
    branches:
      - main

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

      - name: Deploy to Green
        run: npm run deploy:green -- --image-tag=${{ github.sha }}

      - name: Run smoke tests
        run: npm run test:smoke:green

      - name: Switch traffic to Green
        run: npm run switch-traffic:green

      - name: Wait for stabilization
        run: sleep 30

      - name: Scale down Blue
        run: npm run scale-down:blue

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deployed to production: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Rollback Workflow

```yaml
# .github/workflows/rollback.yml
name: Rollback to Blue

on:
  workflow_dispatch:

jobs:
  rollback:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Rollback to Blue
        run: npm run rollback:blue

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Rolled back to Blue"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

## Rollback

### Automated Rollback

```typescript
// scripts/automated-rollback.ts
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({ region: 'us-east-1' });

export async function monitorAndRollback() {
  console.log('Starting automated monitoring...');

  const alarmName = 'servio-production-error-rate';

  while (true) {
    const alarm = await cloudwatch.describeAlarms({
      AlarmNames: [alarmName],
    }).promise();

    if (alarm.MetricAlarms![0].StateValue === 'ALARM') {
      console.log('Error rate alarm triggered, initiating rollback...');
      await rollbackToBlue();
      break;
    }

    await sleep(60000); // Check every minute
  }
}

export async function setupAlarms() {
  // Error rate alarm
  await cloudwatch.putMetricAlarm({
    AlarmName: 'servio-production-error-rate',
    AlarmDescription: 'Error rate exceeds threshold',
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
    AlarmDescription: 'Response time exceeds threshold',
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
}
```

## Best Practices

### 1. Use Identical Environments

Use identical Blue and Green environments:

```yaml
# Good: Identical environments
resource "aws_ecs_service" "blue" {
  desired_count = 3
  # ... same configuration as green
}

resource "aws_ecs_service" "green" {
  desired_count = 0
  # ... same configuration as blue
}

# Bad: Different configurations
resource "aws_ecs_service" "blue" {
  desired_count = 3
  # ... different configuration
}

resource "aws_ecs_service" "green" {
  desired_count = 0
  # ... different configuration
}
```

### 2. Test Before Switching

Test Green environment before switching traffic:

```typescript
// Good: Test before switching
await runSmokeTests('green');
await switchTraffic('green');

// Bad: Switch without testing
await switchTraffic('green');
```

### 3. Monitor After Switching

Monitor after switching traffic:

```typescript
// Good: Monitor after switching
await switchTraffic('green');
await monitorAndRollback();

// Bad: No monitoring
await switchTraffic('green');
```

### 4. Automate Rollback

Automate rollback on failures:

```typescript
// Good: Automated rollback
export async function monitorAndRollback() {
  while (true) {
    const alarm = await checkAlarm();
    if (alarm.StateValue === 'ALARM') {
      await rollbackToBlue();
      break;
    }
    await sleep(60000);
  }
}

// Bad: Manual rollback
// No automated rollback
```

### 5. Use Health Checks

Use health checks to verify deployment:

```typescript
// Good: Use health checks
async function waitForServiceHealth(serviceName: string) {
  for (let i = 0; i < maxAttempts; i++) {
    const service = await getServiceHealth(serviceName);
    if (service.healthy) {
      return;
    }
    await sleep(interval);
  }
  throw new Error('Service did not become healthy');
}

// Bad: No health checks
await scaleService(serviceName, 3);
// No health checks
```

### 6. Document Rollback Procedure

Document rollback procedure:

```markdown
# Good: Document rollback
## Rollback Procedure

1. Run: `npm run rollback:blue`
2. Monitor: `npm run monitor:production`
3. Verify: Check logs and metrics

# Bad: No documentation
# No documentation
```

### 7. Practice Rollbacks

Practice rollbacks regularly:

```bash
# Good: Practice rollbacks
# Schedule regular rollback drills
0 0 * * 1 npm run rollback:drill

# Bad: No practice
# No practice
```

## References

- [Blue-Green Deployment](https://martinfowler.com/bliki/BlueGreenDeployment)
- [AWS ECS](https://aws.amazon.com/ecs/)
- [Deployment Strategies](https://www.nginx.com/blog/deployment-strategies/)
- [Zero Downtime Deployment](https://www.atlassian.com/continuous-delivery/principles/zero-downtime-deployment)
