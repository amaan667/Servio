# Staging Environment for Pre-Production Testing

This document describes the setup and management of a staging environment for pre-production testing on the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Features](#features)
3. [Infrastructure](#infrastructure)
4. [Configuration](#configuration)
5. [Deployment](#deployment)
6. [Testing](#testing)
7. [Best Practices](#best-practices)

## Overview

A staging environment is a pre-production environment that closely mirrors the production environment. It allows teams to:

- **Test changes:** Test new features and bug fixes before production
- **Validate deployments:** Ensure deployments work as expected
- **Performance testing:** Test performance under realistic conditions
- **Security testing:** Test security measures in a production-like environment
- **User acceptance testing:** Allow stakeholders to test changes

## Features

### Infrastructure as Code

```yaml
# terraform/staging/main.tf
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket = "servio-terraform-state"
    key    = "staging/terraform.tfstate"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

# VPC
resource "aws_vpc" "staging" {
  cidr_block           = "10.1.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name        = "servio-staging-vpc"
    Environment = "staging"
  }
}

# Subnets
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = "10.1.${count.index}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name        = "servio-staging-public-${count.index}"
    Environment = "staging"
  }
}

resource "aws_subnet" "private" {
  count                   = 2
  vpc_id                  = aws_vpc.staging.id
  cidr_block              = "10.1.${count.index + 2}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name        = "servio-staging-private-${count.index}"
    Environment = "staging"
  }
}

# ECS Cluster
resource "aws_ecs_cluster" "staging" {
  name = "servio-staging"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ECS Task Definition
resource "aws_ecs_task_definition" "app" {
  family                   = "servio-staging-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = "${var.ecr_repository_url}:staging"
      cpu       = 256
      memory    = 512
      essential = true

      portMappings = [
        {
          containerPort = 3000
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "NODE_ENV"
          value = "staging"
        },
        {
          name  = "DATABASE_URL"
          value = var.staging_database_url
        },
        {
          name  = "REDIS_URL"
          value = var.staging_redis_url
        }
      ]

      secrets = [
        {
          name      = "SUPABASE_ANON_KEY"
          valueFrom = aws_secretsmanager_secret.supabase_anon_key.arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix"   = "app"
          "awslogs-create-group"   = "true"
        }
      }
    }
  ])
}

# ECS Service
resource "aws_ecs_service" "app" {
  name            = "servio-staging-app"
  cluster         = aws_ecs_cluster.staging.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type    = "FARGATE"

  network_configuration {
    subnets          = aws_subnet.private[*].id
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = 3000
  }

  depends_on = [aws_lb_listener.app]
}
```

### Database Configuration

```yaml
# terraform/staging/database.tf
# RDS PostgreSQL
resource "aws_db_instance" "staging" {
  identifier     = "servio-staging-db"
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  allocated_storage     = 20
  storage_type         = "gp2"
  storage_encrypted    = true
  db_name  = "servio_staging"
  username = "servio"
  password = var.staging_db_password

  vpc_security_group_ids = [aws_security_group.database.id]
  db_subnet_group_name   = aws_db_subnet_group.staging.name

  backup_retention_period = 7
  backup_window        = "03:00-04:00"
  maintenance_window   = "Mon:04:00-Mon:05:00"

  tags = {
    Name        = "servio-staging-db"
    Environment = "staging"
  }
}

# RDS Subnet Group
resource "aws_db_subnet_group" "staging" {
  name       = "servio-staging-db-subnet-group"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name        = "servio-staging-db-subnet-group"
    Environment = "staging"
  }
}

# ElastiCache Redis
resource "aws_elasticache_replication_group" "staging" {
  replication_group_id          = "servio-staging-redis"
  description                  = "Servio Staging Redis"
  node_type                    = "cache.t3.micro"
  num_cache_clusters            = 1
  automatic_failover_enabled    = false
  multi_az_enabled              = false
  engine                       = "redis"
  engine_version               = "7.0"
  parameter_group_name          = "default.redis7"
  at_rest_encryption_enabled    = true
  transit_encryption_enabled    = true

  subnet_group_name = aws_elasticache_subnet_group.staging.name
  security_group_ids = [aws_security_group.redis.id]

  tags = {
    Name        = "servio-staging-redis"
    Environment = "staging"
  }
}
```

### Load Balancer

```yaml
# terraform/staging/load-balancer.tf
# Application Load Balancer
resource "aws_lb" "app" {
  name               = "servio-staging-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false
  enable_http2           = true

  tags = {
    Name        = "servio-staging-alb"
    Environment = "staging"
  }
}

# Target Group
resource "aws_lb_target_group" "app" {
  name        = "servio-staging-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.staging.id
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
    Name        = "servio-staging-tg"
    Environment = "staging"
  }
}

# Listener
resource "aws_lb_listener" "app" {
  load_balancer_arn = aws_lb.app.arn
  port              = "443"
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS-1-2-2017-01"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }

  certificate_arn = var.staging_ssl_certificate_arn
}
```

## Configuration

### Environment Variables

```bash
# .env.staging
NODE_ENV=staging
NEXT_PUBLIC_APP_URL=https://staging.servio.com
NEXT_PUBLIC_API_URL=https://api.staging.servio.com

# Database
DATABASE_URL=postgresql://servio:password@servio-staging-db.xxxx.us-east-1.rds.amazonaws.com:5432/servio_staging

# Redis
REDIS_URL=redis://servio-staging-redis.xxxx.cache.amazonaws.com:6379

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=staging_anon_key
SUPABASE_SERVICE_ROLE_KEY=staging_service_role_key

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxxx
STRIPE_SECRET_KEY=sk_test_xxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxx

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@sentry.io/xxxx
SENTRY_ENVIRONMENT=staging

# Feature Flags
LAUNCHDARKLY_SDK_KEY=staging_sdk_key
UNLEASH_API_URL=https://staging.unleash.io/api
UNLEASH_API_KEY=staging_api_key

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=https://xxxx@sentry.io/xxxx
DATADOG_API_KEY=staging_api_key
DATADOG_APP_KEY=staging_app_key
```

### Docker Compose for Local Staging

```yaml
# docker-compose.staging.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=staging
      - DATABASE_URL=postgresql://servio:password@postgres:5432/servio_staging
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis
    networks:
      - staging

  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=servio
      - POSTGRES_PASSWORD=password
      - POSTGRES_DB=servio_staging
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - staging

  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data
    networks:
      - staging

volumes:
  postgres_data:
  redis_data:

networks:
  staging:
    driver: bridge
```

## Deployment

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches:
      - main
      - develop

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
          docker build -t servio-app:staging .
          docker tag servio-app:staging ${ECR_REGISTRY}/servio-app:staging

      - name: Login to ECR
        uses: aws-actions/amazon-ecr-login@v2
        with:
          mask-password: 'true'

      - name: Push to ECR
        run: |
          docker push ${ECR_REGISTRY}/servio-app:staging

      - name: Deploy to ECS
        uses: aws-actions/amazon-ecs-deploy@v2
        with:
          task-definition: servio-staging-app
          service: servio-staging-app
          cluster: servio-staging
          wait-for-service-stability: true
          force-new-deployment: true

      - name: Run smoke tests
        run: npm run test:smoke:staging

      - name: Notify Slack
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Deployed to staging: ${{ github.sha }}"
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
```

### Smoke Tests

```typescript
// __tests__/smoke/staging.test.ts
import { test, expect } from '@playwright/test';

test.describe('Staging Smoke Tests', () => {
  test('should load the homepage', async ({ page }) => {
    await page.goto('https://staging.servio.com');
    await expect(page).toHaveTitle(/Servio/);
  });

  test('should allow login', async ({ page }) => {
    await page.goto('https://staging.servio.com/login');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/dashboard/);
  });

  test('should load API health endpoint', async ({ request }) => {
    const response = await request.get('https://api.staging.servio.com/health');
    expect(response.status()).toBe(200);
  });

  test('should load venues API', async ({ request }) => {
    const response = await request.get('https://api.staging.servio.com/api/v1/venues');
    expect(response.status()).toBe(200);
  });
});
```

## Testing

### Automated Testing

```typescript
// scripts/test-staging.ts
import { test } from '@playwright/test';

test.describe('Staging Automated Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('https://staging.servio.com');
  });

  test('should create a venue', async ({ page }) => {
    await page.click('text=Venues');
    await page.click('text=Create Venue');
    await page.fill('input[name="name"]', 'Test Venue');
    await page.fill('input[name="address"]', '123 Test St');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Venue created')).toBeVisible();
  });

  test('should create a menu', async ({ page }) => {
    await page.click('text=Menus');
    await page.click('text=Create Menu');
    await page.fill('input[name="name"]', 'Test Menu');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Menu created')).toBeVisible();
  });

  test('should create an order', async ({ page }) => {
    await page.click('text=Orders');
    await page.click('text=Create Order');
    await page.selectOption('select[name="venue"]', 'Test Venue');
    await page.selectOption('select[name="menu"]', 'Test Menu');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Order created')).toBeVisible();
  });
});
```

### Performance Testing

```typescript
// __tests__/performance/staging.k6.ts
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 50 },
    { duration: '1m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.get('https://staging.servio.com');

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);
}
```

## Best Practices

### 1. Mirror Production

Mirror production environment as closely as possible:

```yaml
# Good: Mirror production
resource "aws_db_instance" "staging" {
  instance_class = "db.t3.micro" # Similar to production
  engine_version = "15.4" # Same as production
}

# Bad: Different configuration
resource "aws_db_instance" "staging" {
  instance_class = "db.t2.micro" # Different from production
  engine_version = "14.0" # Different from production
}
```

### 2. Use Real Data

Use anonymized production data in staging:

```bash
# Good: Use anonymized data
pg_dump --no-owner --no-acl production_db | \
  sed 's/email=.*/email=anonymized@example.com/g' | \
  psql staging_db

# Bad: Use fake data
# No data or completely fake data
```

### 3. Automate Deployment

Automate deployment to staging:

```yaml
# Good: Automated deployment
on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to staging
        run: npm run deploy:staging

# Bad: Manual deployment
# No automation
```

### 4. Run Smoke Tests

Run smoke tests after deployment:

```yaml
# Good: Run smoke tests
- name: Run smoke tests
  run: npm run test:smoke:staging

# Bad: No smoke tests
# No smoke tests
```

### 5. Monitor Staging

Monitor staging environment:

```typescript
// Good: Monitor staging
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: 'staging',
});

// Bad: No monitoring
// No monitoring
```

### 6. Clean Up Regularly

Clean up staging environment regularly:

```bash
# Good: Clean up regularly
# Cron job to clean up old data
0 2 * * * psql -c "DELETE FROM orders WHERE created_at < NOW() - INTERVAL '7 days'"

# Bad: No cleanup
# No cleanup
```

### 7. Document Staging

Document staging environment:

```markdown
# Good: Document staging
# docs/STAGING-ENVIRONMENT.md

## Overview
The staging environment is located at https://staging.servio.com

## Access
- URL: https://staging.servio.com
- Database: servio-staging-db.xxxx.us-east-1.rds.amazonaws.com
- Redis: servio-staging-redis.xxxx.cache.amazonaws.com

# Bad: No documentation
# No documentation
```

## References

- [Staging Best Practices](https://martinfowler.com/articles/production-readiness/)
- [Infrastructure as Code](https://www.terraform.io/)
- [AWS ECS](https://aws.amazon.com/ecs/)
- [GitHub Actions](https://github.com/features/actions)
