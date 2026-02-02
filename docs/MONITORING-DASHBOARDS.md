# Monitoring Dashboard Configuration

This document provides comprehensive monitoring dashboard configurations for the Servio platform. These dashboards can be imported into monitoring tools like Grafana, Datadog, or New Relic.

## Table of Contents

1. [Overview](#overview)
2. [Dashboard Categories](#dashboard-categories)
3. [Dashboard Configurations](#dashboard-configurations)
4. [Alert Rules](#alert-rules)
5. [Installation](#installation)

## Overview

The Servio platform uses a comprehensive monitoring strategy with multiple dashboards covering different aspects of the system:

- **Application Performance**: Response times, throughput, error rates
- **Infrastructure**: CPU, memory, disk, network metrics
- **Database**: Query performance, connections, locks
- **Business Metrics**: Orders, revenue, user activity
- **Security**: Authentication, authorization, rate limiting
- **AI/ML**: Assistant performance, token usage, response times

## Dashboard Categories

### 1. Application Performance Dashboard

**Purpose**: Monitor application health and performance

**Key Metrics**:
- Request rate (RPS)
- Response time (p50, p95, p99)
- Error rate (4xx, 5xx)
- Active connections
- Memory usage
- CPU usage

### 2. Infrastructure Dashboard

**Purpose**: Monitor server and infrastructure health

**Key Metrics**:
- CPU utilization
- Memory utilization
- Disk usage
- Network I/O
- Container health
- Service availability

### 3. Database Dashboard

**Purpose**: Monitor database performance and health

**Key Metrics**:
- Query execution time
- Active connections
- Connection pool usage
- Query throughput
- Slow queries
- Lock wait time
- Replication lag

### 4. Business Metrics Dashboard

**Purpose**: Monitor business KPIs and metrics

**Key Metrics**:
- Orders per minute
- Revenue per hour
- Active users
- Venue activity
- Menu item popularity
- Average order value

### 5. Security Dashboard

**Purpose**: Monitor security events and threats

**Key Metrics**:
- Failed login attempts
- Rate limit violations
- API key usage
- Suspicious activity
- Authentication success rate

### 6. AI/ML Dashboard

**Purpose**: Monitor AI assistant performance

**Key Metrics**:
- Token usage
- Response time
- Success rate
- User satisfaction
- Cost per request

## Dashboard Configurations

### Grafana Dashboard JSON

```json
{
  "dashboard": {
    "title": "Servio - Application Performance",
    "uid": "servio-app-performance",
    "tags": ["servio", "application", "performance"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Request Rate (RPS)",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total[1m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Response Time (p95)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "{{route}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
            "legendFormat": "5xx Errors"
          },
          {
            "expr": "rate(http_requests_total{status=~\"4..\"}[5m])",
            "legendFormat": "4xx Errors"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "http_active_connections",
            "legendFormat": "Active"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 12, "y": 8}
      },
      {
        "id": 5,
        "title": "Memory Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "process_resident_memory_bytes / 1024 / 1024",
            "legendFormat": "Memory (MB)"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      },
      {
        "id": 6,
        "title": "CPU Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(process_cpu_seconds_total[1m]) * 100",
            "legendFormat": "CPU %"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 16}
      }
    ]
  }
}
```

### Database Dashboard JSON

```json
{
  "dashboard": {
    "title": "Servio - Database Performance",
    "uid": "servio-database",
    "tags": ["servio", "database", "postgresql"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Query Execution Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(pg_stat_statements_total_exec_time_ms[5m])",
            "legendFormat": "{{query}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Active Connections",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends",
            "legendFormat": "{{datname}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Connection Pool Usage",
        "type": "gauge",
        "targets": [
          {
            "expr": "pgbouncer_pool_connections_active / pgbouncer_pool_connections_max * 100",
            "legendFormat": "Pool Usage %"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Slow Queries (>1s)",
        "type": "stat",
        "targets": [
          {
            "expr": "count(pg_stat_statements_mean_exec_time_ms > 1000)",
            "legendFormat": "Slow Queries"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8}
      },
      {
        "id": 5,
        "title": "Lock Wait Time",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(pg_locks_wait_time_ms[5m])",
            "legendFormat": "Lock Wait Time"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      },
      {
        "id": 6,
        "title": "Replication Lag",
        "type": "graph",
        "targets": [
          {
            "expr": "pg_stat_replication_lag_seconds",
            "legendFormat": "Lag (s)"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      }
    ]
  }
}
```

### Business Metrics Dashboard JSON

```json
{
  "dashboard": {
    "title": "Servio - Business Metrics",
    "uid": "servio-business",
    "tags": ["servio", "business", "metrics"],
    "timezone": "browser",
    "refresh": "1m",
    "panels": [
      {
        "id": 1,
        "title": "Orders Per Minute",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(orders_created_total[1m])",
            "legendFormat": "Orders/min"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Revenue Per Hour",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(order_revenue_total[1h])",
            "legendFormat": "Revenue/hour"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "active_users_total",
            "legendFormat": "Active Users"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Active Venues",
        "type": "stat",
        "targets": [
          {
            "expr": "active_venues_total",
            "legendFormat": "Active Venues"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8}
      },
      {
        "id": 5,
        "title": "Average Order Value",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(order_revenue_total[1h]) / rate(orders_created_total[1h])",
            "legendFormat": "Avg Order Value"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      },
      {
        "id": 6,
        "title": "Top Menu Items",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, menu_item_orders_total)",
            "legendFormat": "{{menu_item}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      }
    ]
  }
}
```

### Security Dashboard JSON

```json
{
  "dashboard": {
    "title": "Servio - Security",
    "uid": "servio-security",
    "tags": ["servio", "security"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Failed Login Attempts",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(auth_login_failures_total[5m])",
            "legendFormat": "Failed Logins/min"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Rate Limit Violations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(rate_limit_violations_total[5m])",
            "legendFormat": "Violations/min"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Authentication Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "rate(auth_login_successes_total[5m]) / (rate(auth_login_successes_total[5m]) + rate(auth_login_failures_total[5m])) * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "API Key Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "api_key_requests_total",
            "legendFormat": "API Key Requests"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8}
      },
      {
        "id": 5,
        "title": "Suspicious Activity",
        "type": "table",
        "targets": [
          {
            "expr": "security_suspicious_events_total",
            "legendFormat": "{{event_type}}"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      }
    ]
  }
}
```

### AI/ML Dashboard JSON

```json
{
  "dashboard": {
    "title": "Servio - AI/ML Performance",
    "uid": "servio-ai-ml",
    "tags": ["servio", "ai", "ml"],
    "timezone": "browser",
    "refresh": "30s",
    "panels": [
      {
        "id": 1,
        "title": "Token Usage",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ai_tokens_used_total[5m])",
            "legendFormat": "Tokens/min"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "AI Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(ai_response_time_seconds_bucket[5m]))",
            "legendFormat": "p95 Response Time"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "AI Success Rate",
        "type": "gauge",
        "targets": [
          {
            "expr": "rate(ai_requests_success_total[5m]) / rate(ai_requests_total[5m]) * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Cost Per Request",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(ai_cost_total[5m]) / rate(ai_requests_total[5m])",
            "legendFormat": "Cost/Request"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 8}
      },
      {
        "id": 5,
        "title": "User Satisfaction",
        "type": "graph",
        "targets": [
          {
            "expr": "avg(ai_user_satisfaction_score)",
            "legendFormat": "Satisfaction Score"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 16}
      }
    ]
  }
}
```

## Alert Rules

### Critical Alerts

```yaml
groups:
  - name: servio.critical
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High response time detected"
          description: "p95 response time is {{ $value }}s"

      - alert: DatabaseConnectionPoolExhausted
        expr: pgbouncer_pool_connections_active / pgbouncer_pool_connections_max > 0.9
        for: 5m
        labels:
          severity: critical
          team: database
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Connection pool usage is {{ $value | humanizePercentage }}"

      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / node_memory_MemTotal_bytes > 0.9
        for: 5m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "High memory usage detected"
          description: "Memory usage is {{ $value | humanizePercentage }}"

      - alert: ServiceDown
        expr: up{job="servio"} == 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "Service is down"
          description: "Service {{ $labels.instance }} has been down for more than 1 minute"
```

### Warning Alerts

```yaml
groups:
  - name: servio.warning
    interval: 30s
    rules:
      - alert: ElevatedErrorRate
        expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.01
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Elevated error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"

      - alert: ElevatedResponseTime
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Elevated response time detected"
          description: "p95 response time is {{ $value }}s"

      - alert: DatabaseSlowQueries
        expr: rate(pg_stat_statements_total_exec_time_ms[5m]) > 1000
        for: 5m
        labels:
          severity: warning
          team: database
        annotations:
          summary: "Slow database queries detected"
          description: "Average query execution time is {{ $value }}ms"

      - alert: HighCPUUsage
        expr: rate(process_cpu_seconds_total[5m]) > 0.8
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "High CPU usage detected"
          description: "CPU usage is {{ $value | humanizePercentage }}"

      - alert: DiskSpaceLow
        expr: node_filesystem_avail_bytes / node_filesystem_size_bytes < 0.1
        for: 5m
        labels:
          severity: warning
          team: platform
        annotations:
          summary: "Low disk space"
          description: "Disk space is {{ $value | humanizePercentage }} available"
```

### Business Alerts

```yaml
groups:
  - name: servio.business
    interval: 1m
    rules:
      - alert: LowOrderVolume
        expr: rate(orders_created_total[1h]) < 0.1
        for: 10m
        labels:
          severity: warning
          team: business
        annotations:
          summary: "Low order volume detected"
          description: "Order rate is {{ $value }} orders/min"

      - alert: HighOrderVolume
        expr: rate(orders_created_total[1h]) > 100
        for: 5m
        labels:
          severity: info
          team: business
        annotations:
          summary: "High order volume detected"
          description: "Order rate is {{ $value }} orders/min"

      - alert: ZeroRevenue
        expr: rate(order_revenue_total[1h]) == 0
        for: 30m
        labels:
          severity: warning
          team: business
        annotations:
          summary: "No revenue detected"
          description: "No revenue has been generated in the last 30 minutes"
```

### Security Alerts

```yaml
groups:
  - name: servio.security
    interval: 30s
    rules:
      - alert: BruteForceAttack
        expr: rate(auth_login_failures_total[5m]) > 10
        for: 2m
        labels:
          severity: critical
          team: security
        annotations:
          summary: "Possible brute force attack detected"
          description: "Failed login rate is {{ $value }} attempts/min"

      - alert: RateLimitAbuse
        expr: rate(rate_limit_violations_total[5m]) > 100
        for: 2m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "Rate limit abuse detected"
          description: "Rate limit violations rate is {{ $value }} violations/min"

      - alert: SuspiciousActivity
        expr: security_suspicious_events_total > 0
        for: 1m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "Suspicious activity detected"
          description: "{{ $value }} suspicious events detected"
```

## Installation

### Grafana Installation

1. **Import Dashboards**:
   ```bash
   # Using Grafana CLI
   grafana-cli admin import-dashboard \
     --config /etc/grafana/grafana.ini \
     --homepath /usr/share/grafana \
     --file docs/monitoring/app-performance-dashboard.json
   ```

2. **Via Grafana UI**:
   - Navigate to Dashboards → Import
   - Upload the JSON file
   - Select the data source
   - Click Import

### Prometheus Installation

1. **Install Prometheus**:
   ```bash
   # Using Docker
   docker run -d \
     --name prometheus \
     -p 9090:9090 \
     -v /path/to/prometheus.yml:/etc/prometheus/prometheus.yml \
     prom/prometheus
   ```

2. **Configure Prometheus**:
   ```yaml
   # prometheus.yml
   global:
     scrape_interval: 15s
     evaluation_interval: 15s

   scrape_configs:
     - job_name: 'servio'
       static_configs:
         - targets: ['localhost:3000']
       metrics_path: '/api/metrics'
   ```

### Alertmanager Installation

1. **Install Alertmanager**:
   ```bash
   docker run -d \
     --name alertmanager \
     -p 9093:9093 \
     -v /path/to/alertmanager.yml:/etc/alertmanager/alertmanager.yml \
     prom/alertmanager
   ```

2. **Configure Alertmanager**:
   ```yaml
   # alertmanager.yml
   global:
     resolve_timeout: 5m

   route:
     group_by: ['alertname', 'cluster', 'service']
     group_wait: 10s
     group_interval: 10s
     repeat_interval: 12h
     receiver: 'default'

     routes:
       - match:
           severity: critical
         receiver: 'critical-alerts'

   receivers:
     - name: 'default'
       email_configs:
         - to: 'team@example.com'

     - name: 'critical-alerts'
       pagerduty_configs:
         - service_key: '<your-service-key>'
       slack_configs:
         - api_url: '<your-slack-webhook>'
   ```

## Maintenance

### Regular Tasks

1. **Review dashboards weekly** for relevance and accuracy
2. **Update alert thresholds** based on business needs
3. **Add new metrics** as features are added
4. **Remove obsolete metrics** and dashboards
5. **Test alert notifications** regularly

### Performance Considerations

1. **Limit dashboard refresh rates** to avoid excessive load
2. **Use appropriate time ranges** for queries
3. **Optimize PromQL queries** for performance
4. **Set appropriate retention periods** for metrics

## References

- [Grafana Documentation](https://grafana.com/docs/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Alertmanager Documentation](https://prometheus.io/docs/alerting/latest/alertmanager/)
- [Monitoring Best Practices](https://prometheus.io/docs/practices/)
