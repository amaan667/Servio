# Chaos Testing

This document describes the chaos testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Benefits](#benefits)
3. [Tools](#tools)
4. [Setup](#setup)
5. [Writing Tests](#writing-tests)
6. [Scenarios](#scenarios)
7. [CI/CD Integration](#cicd-integration)
8. [Best Practices](#best-practices)

## Overview

Chaos testing intentionally introduces failures to test system resilience. This helps:

- **Build Resilience**: Identify and fix weak points
- **Improve Recovery**: Test and improve recovery mechanisms
- **Prevent Outages**: Catch issues before production
- **Build Confidence**: Trust in system reliability

## Benefits

### For Development Teams
- **Proactive Testing**: Find issues before users do
- **Better Understanding**: Learn system behavior under stress
- **Improved Design**: Build more resilient systems

### For Operations Teams
- **Faster Recovery**: Practice recovery procedures
- **Better Monitoring**: Identify gaps in monitoring
- **Reduced Downtime**: Minimize impact of failures

## Tools

### Chaos Mesh

Chaos Mesh is a cloud-native chaos engineering platform.

**Pros:**
- Kubernetes-native
- Rich fault injection
- Good documentation
- Active community

**Cons:**
- Kubernetes required
- Learning curve

### Gremlin

Gremlin is a SaaS chaos engineering platform.

**Pros:**
- Easy to use
- Cloud-based
- Good UI
- Pre-built scenarios

**Cons:**
- Paid service
- Limited free tier

### Chaos Monkey

Chaos Monkey is Netflix's chaos testing tool.

**Pros:**
- Open source
- Simple to use
- Well-documented

**Cons:**
- Limited to instance termination
- Less feature-rich

## Setup

### Option 1: Chaos Mesh

#### Installation

```bash
# Install Chaos Mesh
curl -sSL https://mirrors.chaos-mesh.org/v1.2.1/install.sh | bash

# Verify installation
kubectl get pod -n chaos-testing
```

#### Configuration

```yaml
# chaos-mesh-config.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: ChaosMesh
metadata:
  name: chaos-mesh
  namespace: chaos-testing
spec:
  # Enable chaos experiments
  chaos:
    # Pod chaos
    podChaos: true
    # Network chaos
    networkChaos: true
    # IO chaos
    ioChaos: true
    # Kernel chaos
    kernelChaos: true
    # Time chaos
    timeChaos: true
    # DNS chaos
    dnsChaos: true
    # HTTP chaos
    httpChaos: true
    # AWS chaos
    awsChaos: true
    # GCP chaos
    gcpChaos: true
```

### Option 2: Gremlin

#### Installation

```bash
# Install Gremlin agent
curl -O https://downloads.gremlin.com/release/gremlinctl.sh
chmod +x gremlinctl.sh
sudo ./gremlinctl.sh install

# Configure Gremlin
gremlin configure \
  --team-id <your-team-id> \
  --team-secret <your-team-secret>
```

#### Configuration

```yaml
# gremlin-config.yaml
team_id: <your-team-id>
team_secret: <your-team-secret>
identifier: servio-production
company: Servio
tags:
  - production
  - restaurant-platform
```

### Option 3: Chaos Monkey

#### Installation

```bash
# Install Chaos Monkey
pip install chaosmonkey

# Initialize Chaos Monkey
chaosmonkey init
```

#### Configuration

```python
# chaosmonkey.py
from chaosmonkey import ChaosMonkey

chaos = ChaosMonkey(
    enabled=True,
    probability=0.1,  # 10% chance of termination
    min_time_between_runs=60,  # Minimum 60 seconds between runs
    max_time_between_runs=300,  # Maximum 300 seconds between runs
)

chaos.start()
```

## Writing Tests

### Pod Failure Test

```yaml
# chaos/pod-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure
  namespace: servio
spec:
  action: pod-failure
  mode: one
  gracePeriod: 0
  selector:
    labelSelectors:
      app: servio-api
  scheduler:
    cron: '@every 10m'
```

### Network Latency Test

```yaml
# chaos/network-latency.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-latency
  namespace: servio
spec:
  action: delay
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  delay:
    latency: '100ms'
    jitter: '10ms'
    correlation: '25'
  direction: to
  target: pod
  scheduler:
    cron: '@every 15m'
```

### Network Partition Test

```yaml
# chaos/network-partition.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-partition
  namespace: servio
spec:
  action: partition
  mode: all
  selector:
    labelSelectors:
      app: servio-api
  direction: both
  scheduler:
    cron: '@every 30m'
```

### CPU Stress Test

```yaml
# chaos/cpu-stress.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: cpu-stress
  namespace: servio
spec:
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  stressors:
    cpu:
      workers: 4
      load: 80
  scheduler:
    cron: '@every 20m'
```

### Memory Stress Test

```yaml
# chaos/memory-stress.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: memory-stress
  namespace: servio
spec:
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  stressors:
    memory:
      workers: 4
      size: '80%'
  scheduler:
    cron: '@every 20m'
```

### Disk Failure Test

```yaml
# chaos/disk-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: IOChaos
metadata:
  name: disk-failure
  namespace: servio
spec:
  action: diskFailure
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  duration: '30s'
  percent: 50
  scheduler:
    cron: '@every 1h'
```

## Scenarios

### 1. Database Failure

Test system behavior when database becomes unavailable.

```yaml
# chaos/scenarios/database-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: database-failure
  namespace: servio
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: postgres
  scheduler:
    cron: '@every 2h'
```

**Expected Behavior:**
- Application should detect database failure
- Retry logic should activate
- Circuit breaker should open
- User should see appropriate error message
- System should recover when database is back

### 2. API Service Failure

Test system behavior when API service fails.

```yaml
# chaos/scenarios/api-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: api-failure
  namespace: servio
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  scheduler:
    cron: '@every 1h'
```

**Expected Behavior:**
- Load balancer should route traffic to healthy instances
- Health checks should detect failure
- New instances should be spun up
- Users should experience minimal disruption

### 3. Network Latency

Test system behavior with increased network latency.

```yaml
# chaos/scenarios/network-latency.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-latency
  namespace: servio
spec:
  action: delay
  mode: all
  selector:
    labelSelectors:
      app: servio-api
  delay:
    latency: '500ms'
    jitter: '50ms'
  duration: '5m'
  scheduler:
    cron: '@every 3h'
```

**Expected Behavior:**
- Application should handle increased latency
- Timeouts should be configured appropriately
- User experience should degrade gracefully
- Monitoring should detect increased response times

### 4. Network Partition

Test system behavior when network is partitioned.

```yaml
# chaos/scenarios/network-partition.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: NetworkChaos
metadata:
  name: network-partition
  namespace: servio
spec:
  action: partition
  mode: all
  selector:
    labelSelectors:
      app: servio-api
  direction: both
  duration: '2m'
  scheduler:
    cron: '@every 4h'
```

**Expected Behavior:**
- Services should handle network partitions
- Circuit breakers should activate
- System should recover when network is restored
- Data consistency should be maintained

### 5. Resource Exhaustion

Test system behavior when resources are exhausted.

```yaml
# chaos/scenarios/resource-exhaustion.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: StressChaos
metadata:
  name: resource-exhaustion
  namespace: servio
spec:
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  stressors:
    cpu:
      workers: 4
      load: 90
    memory:
      workers: 4
      size: '90%'
  duration: '5m'
  scheduler:
    cron: '@every 6h'
```

**Expected Behavior:**
- Application should handle resource constraints
- Graceful degradation should occur
- Monitoring should detect resource exhaustion
- System should recover when resources are available

### 6. DNS Failure

Test system behavior when DNS resolution fails.

```yaml
# chaos/scenarios/dns-failure.yaml
apiVersion: chaos-mesh.org/v1alpha1
kind: DNSChaos
metadata:
  name: dns-failure
  namespace: servio
spec:
  action: error
  mode: all
  selector:
    labelSelectors:
      app: servio-api
  names:
    - postgres
    - redis
  scheduler:
    cron: '@every 8h'
```

**Expected Behavior:**
- Application should handle DNS failures
- Fallback mechanisms should activate
- Monitoring should detect DNS issues
- System should recover when DNS is restored

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/chaos-tests.yml
name: Chaos Tests

on:
  schedule:
    - cron: '0 3 * * *' # Run daily at 3 AM
  workflow_dispatch:

jobs:
  chaos-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up kubectl
        uses: azure/setup-kubectl@v3
        with:
          version: 'v1.28.0'

      - name: Configure kubectl
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig

      - name: Install Chaos Mesh
        run: |
          curl -sSL https://mirrors.chaos-mesh.org/v1.2.1/install.sh | bash

      - name: Apply chaos experiments
        run: |
          kubectl apply -f chaos/pod-failure.yaml
          kubectl apply -f chaos/network-latency.yaml
          kubectl apply -f chaos/cpu-stress.yaml

      - name: Wait for chaos experiments
        run: sleep 600

      - name: Check system health
        run: |
          # Check API health
          curl -f http://servio-api/health || exit 1

          # Check database connectivity
          kubectl exec -n servio deployment/servio-api -- pg_isready || exit 1

      - name: Cleanup chaos experiments
        if: always()
        run: |
          kubectl delete -f chaos/pod-failure.yaml
          kubectl delete -f chaos/network-latency.yaml
          kubectl delete -f chaos/cpu-stress.yaml
```

### Gremlin Integration

```yaml
# .github/workflows/gremlin-chaos.yml
name: Gremlin Chaos Tests

on:
  schedule:
    - cron: '0 4 * * *' # Run daily at 4 AM
  workflow_dispatch:

jobs:
  gremlin-chaos:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Install Gremlin CLI
        run: |
          curl -O https://downloads.gremlin.com/release/gremlinctl.sh
          chmod +x gremlinctl.sh
          sudo ./gremlinctl.sh install

      - name: Configure Gremlin
        run: |
          gremlin configure \
            --team-id ${{ secrets.GREMLIN_TEAM_ID }} \
            --team-secret ${{ secrets.GREMLIN_TEAM_SECRET }}

      - name: Run CPU attack
        run: |
          gremlin attack cpu \
            --target-type container \
            --target-container servio-api \
            --cpu-percent 80 \
            --duration 300

      - name: Run memory attack
        run: |
          gremlin attack memory \
            --target-type container \
            --target-container servio-api \
            --memory-percent 80 \
            --duration 300

      - name: Run network attack
        run: |
          gremlin attack network \
            --target-type container \
            --target-container servio-api \
            --network-latency 500 \
            --duration 300

      - name: Check system health
        run: |
          curl -f http://servio-api/health || exit 1
```

## Best Practices

### 1. Start Small

Begin with small, controlled experiments:

```yaml
# Good: Start with small impact
spec:
  action: delay
  delay:
    latency: '50ms'  # Small latency
  duration: '30s'  # Short duration

# Bad: Start with large impact
spec:
  action: delay
  delay:
    latency: '5000ms'  # Large latency
  duration: '10m'  # Long duration
```

### 2. Test in Staging

Always test in staging first:

```bash
# Staging environment
kubectl apply -f chaos/pod-failure.yaml --namespace=servio-staging

# Production (with caution)
kubectl apply -f chaos/pod-failure.yaml --namespace=servio-production
```

### 3. Monitor During Tests

Monitor system during chaos experiments:

```yaml
# Add monitoring to chaos experiments
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure
  annotations:
    chaos-mesh.org/monitoring: "true"
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: servio-api
```

### 4. Have Rollback Plan

Always have a rollback plan:

```bash
# Quick rollback script
#!/bin/bash
kubectl delete -f chaos/*.yaml
kubectl rollout undo deployment/servio-api
kubectl scale deployment/servio-api --replicas=3
```

### 5. Document Findings

Document all chaos test results:

```markdown
# Chaos Test Results - 2024-01-15

## Test: Pod Failure
- **Scenario**: API pod termination
- **Impact**: 30 seconds of degraded service
- **Recovery**: Automatic, 2 minutes
- **Findings**: Circuit breaker worked correctly
- **Recommendations**: Increase replica count to 5

## Test: Network Latency
- **Scenario**: 500ms network latency
- **Impact**: Increased response times
- **Recovery**: Automatic when latency removed
- **Findings**: Timeouts need adjustment
- **Recommendations**: Increase timeout to 2s
```

### 6. Gradual Increase

Gradually increase chaos intensity:

```yaml
# Week 1: Low intensity
spec:
  action: delay
  delay:
    latency: '50ms'
  duration: '30s'

# Week 2: Medium intensity
spec:
  action: delay
  delay:
    latency: '100ms'
  duration: '1m'

# Week 3: High intensity
spec:
  action: delay
  delay:
    latency: '200ms'
  duration: '2m'
```

### 7. Test During Off-Peak Hours

Run chaos tests during off-peak hours:

```yaml
# Schedule for off-peak hours
scheduler:
  cron: '0 3 * * *'  # 3 AM daily
```

### 8. Involve All Teams

Involve development, operations, and support teams:

```yaml
# Add team notifications
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure
  annotations:
    chaos-mesh.org/notify: "dev-team,ops-team,support-team"
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: servio-api
```

### 9. Automate Recovery

Automate recovery procedures:

```yaml
# Add automated recovery
apiVersion: chaos-mesh.org/v1alpha1
kind: PodChaos
metadata:
  name: pod-failure
  annotations:
    chaos-mesh.org/auto-recovery: "true"
spec:
  action: pod-kill
  mode: one
  selector:
    labelSelectors:
      app: servio-api
  duration: '5m'
```

### 10. Learn from Failures

Learn from every failure:

```markdown
# Lessons Learned

## Failure: Database Connection Pool Exhaustion
- **Cause**: Chaos test caused connection pool exhaustion
- **Impact**: 5 minutes of downtime
- **Root Cause**: Connection pool size too small
- **Fix**: Increased connection pool size
- **Prevention**: Added monitoring for connection pool usage
```

## References

- [Chaos Mesh Documentation](https://chaos-mesh.org/docs/)
- [Gremlin Documentation](https://www.gremlin.com/docs/)
- [Chaos Monkey Documentation](https://netflix.github.io/chaosmonkey/)
- [Principles of Chaos Engineering](https://principlesofchaos.org/)
- [Chaos Engineering Best Practices](https://www.oreilly.com/library/view/chaos-engineering/9781492078225/)
