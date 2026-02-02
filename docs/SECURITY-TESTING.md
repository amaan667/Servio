# Security Testing

This document describes the security testing strategy and implementation for the Servio platform.

## Table of Contents

1. [Overview](#overview)
2. [Security Testing Types](#security-testing-types)
3. [Tools](#tools)
4. [Setup](#setup)
5. [Writing Tests](#writing-tests)
6. [CI/CD Integration](#cicd-integration)
7. [Best Practices](#best-practices)

## Overview

Security testing identifies vulnerabilities and security weaknesses in the Servio platform. This helps:

- **Prevent Breaches**: Find vulnerabilities before attackers
- **Comply with Regulations**: Meet security standards
- **Protect Data**: Safeguard customer information
- **Build Trust**: Demonstrate security commitment

## Security Testing Types

### 1. Static Application Security Testing (SAST)

Analyzes source code for security vulnerabilities without executing the code.

**Tools:**
- SonarQube
- Semgrep
- CodeQL
- Snyk

### 2. Dynamic Application Security Testing (DAST)

Analyzes running applications for security vulnerabilities.

**Tools:**
- OWASP ZAP
- Burp Suite
- Nessus
- Acunetix

### 3. Interactive Application Security Testing (IAST)

Combines SAST and DAST by analyzing code during execution.

**Tools:**
- Contrast Security
- Seeker
- Fortify IAST

### 4. Dependency Scanning

Scans third-party dependencies for known vulnerabilities.

**Tools:**
- Snyk
- Dependabot
- npm audit
- OWASP Dependency-Check

### 5. Container Scanning

Scans Docker images for vulnerabilities.

**Tools:**
- Trivy
- Clair
- Docker Scout
- Aqua Security

## Tools

### OWASP ZAP

OWASP ZAP is a free, open-source web application security scanner.

**Pros:**
- Free and open source
- Active community
- Good documentation
- CI/CD integration

**Cons:**
- Can be complex to configure
- May produce false positives

### Burp Suite

Burp Suite is a comprehensive web application security testing tool.

**Pros:**
- Powerful features
- Good UI
- Extensive documentation
- Professional support

**Cons:**
- Paid for professional edition
- Steeper learning curve

### Snyk

Snyk is a developer-first security platform.

**Pros:**
- Easy to use
- Good CI/CD integration
- Comprehensive vulnerability database
- Real-time alerts

**Cons:**
- Paid for enterprise features
- Limited free tier

### Trivy

Trivy is a comprehensive security scanner for containers and file systems.

**Pros:**
- Fast and lightweight
- Supports multiple formats
- Good CI/CD integration
- Open source

**Cons:**
- Less feature-rich than commercial tools

## Setup

### OWASP ZAP Setup

#### Installation

```bash
# macOS
brew install zaproxy

# Linux
sudo apt-get install zaproxy

# Docker
docker pull owasp/zap2docker-stable
```

#### Configuration

```bash
# Start ZAP in daemon mode
zap.sh -daemon -port 8080 -config api.disablekey=true

# Or using Docker
docker run -u zap -p 8080:8080 -i owasp/zap2docker-stable zap.sh -daemon -port 8080 -config api.disablekey=true
```

### Burp Suite Setup

#### Installation

```bash
# Download from https://portswigger.net/burp/communitydownload
# Extract and run
./burpsuite_community_linux_v2023_10.sh
```

#### Configuration

```bash
# Start Burp Suite in headless mode
java -jar burpsuite_community.jar --project-file=project.burp --headless
```

### Snyk Setup

#### Installation

```bash
# npm
npm install -g snyk

# Docker
docker pull snyk/snyk-cli
```

#### Configuration

```bash
# Authenticate
snyk auth <your-api-token>

# Test configuration
snyk test
```

### Trivy Setup

#### Installation

```bash
# macOS
brew install trivy

# Linux
sudo apt-get install trivy

# Docker
docker pull aquasec/trivy:latest
```

#### Configuration

```bash
# Update vulnerability database
trivy image --download-db-only

# Scan image
trivy image servio:latest
```

## Writing Tests

### OWASP ZAP Tests

#### Automated Scan

```bash
# Start ZAP
zap.sh -daemon -port 8080 -config api.disablekey=true

# Run baseline scan
zap-baseline.py \
  -t http://localhost:3000 \
  -g gen_file \
  -r report.html \
  --self-contained \
  --start-options '-config api.disablekey=true'

# Run full scan
zap-full-scan.py \
  -t http://localhost:3000 \
  -r report.html \
  --self-contained
```

#### API Scan

```bash
# Scan API endpoints
zap-api-scan.py \
  -t http://localhost:3000/api \
  -f openapi \
  -r report.html \
  --self-contained
```

#### Spider Scan

```bash
# Spider the application
zap-spider.py \
  -t http://localhost:3000 \
  -r report.html \
  --self-contained
```

### Burp Suite Tests

#### Automated Scan

```bash
# Start Burp Suite
java -jar burpsuite_community.jar --project-file=project.burp --headless

# Run scan using Burp Suite API
curl -X POST http://localhost:8080/JSON/scan \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "http://localhost:3000",
    "scan_configurations": ["Default Configuration"]
  }'
```

#### Active Scan

```bash
# Run active scan
curl -X POST http://localhost:8080/JSON/activeScan \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "http://localhost:3000",
    "scan_configurations": ["Default Configuration"]
  }'
```

### Snyk Tests

#### Dependency Scanning

```bash
# Scan package.json
snyk test

# Scan with severity threshold
snyk test --severity-threshold=high

# Scan with custom policy
snyk test --policy-file=.snyk
```

#### Container Scanning

```bash
# Scan Docker image
snyk container test servio:latest

# Scan with severity threshold
snyk container test servio:latest --severity-threshold=high
```

#### Code Scanning

```bash
# Scan source code
snyk code

# Scan with custom rules
snyk code --rules-file=.snyk-rules
```

### Trivy Tests

#### Image Scanning

```bash
# Scan Docker image
trivy image servio:latest

# Scan with severity threshold
trivy image --severity HIGH,CRITICAL servio:latest

# Scan with output format
trivy image --format json --output report.json servio:latest
```

#### File System Scanning

```bash
# Scan file system
trivy fs .

# Scan with severity threshold
trivy fs --severity HIGH,CRITICAL .

# Scan with output format
trivy fs --format json --output report.json .
```

#### Dependency Scanning

```bash
# Scan dependencies
trivy repo .

# Scan with severity threshold
trivy repo --severity HIGH,CRITICAL .

# Scan with output format
trivy repo --format json --output report.json .
```

## CI/CD Integration

### GitHub Actions

```yaml
# .github/workflows/security-tests.yml
name: Security Tests

on:
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 6 * * *' # Run daily at 6 AM

jobs:
  sast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk SAST
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Upload Snyk results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: snyk.sarif

  dependency-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run npm audit
        run: npm audit --audit-level=moderate

      - name: Run Snyk dependency scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  container-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker build -t servio:latest .

      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: 'servio:latest'
          format: 'sarif'
          output: 'trivy-results.sarif'
          severity: 'HIGH,CRITICAL'

      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  dast:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Use Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Build application
        run: npm run build

      - name: Start application
        run: npm run start &
        env:
          PORT: 3000

      - name: Wait for application
        run: npx wait-on http://localhost:3000

      - name: Run OWASP ZAP scan
        uses: zaproxy/action-full-scan@v0.4.0
        with:
          target: 'http://localhost:3000'
          rules_file_name: '.zap/rules.tsv'
          cmd_options: '-a'

      - name: Upload ZAP report
        uses: actions/upload-artifact@v3
        with:
          name: zap-report
          path: report_html.html
```

### GitLab CI

```yaml
# .gitlab-ci.yml
security-scan:
  stage: test
  image: node:18
  script:
    - npm ci
    - npm audit --audit-level=moderate
    - npx snyk test
  artifacts:
    reports:
      sast: gl-sast-report.json
  only:
    - merge_requests
    - main

container-scan:
  stage: test
  image: aquasec/trivy:latest
  script:
    - trivy image --severity HIGH,CRITICAL --format json --output report.json servio:latest
  artifacts:
    reports:
      container_scanning: report.json
  only:
    - merge_requests
    - main

dast:
  stage: test
  image: owasp/zap2docker-stable
  script:
    - zap-baseline.py -t $DAST_WEBSITE -r report.html
  artifacts:
    paths:
      - report.html
  only:
    - merge_requests
    - main
```

## Best Practices

### 1. Scan Early and Often

Scan code at every stage of development:

```yaml
# Scan on every commit
on: [push]

# Scan on every PR
on: [pull_request]

# Scan daily
on:
  schedule:
    - cron: '0 6 * * *'
```

### 2. Use Multiple Tools

Use multiple security tools for comprehensive coverage:

```yaml
jobs:
  snyk-scan:
    # Snyk for dependencies
    runs-on: ubuntu-latest
    steps:
      - uses: snyk/actions/node@master

  trivy-scan:
    # Trivy for containers
    runs-on: ubuntu-latest
    steps:
      - uses: aquasecurity/trivy-action@master

  zap-scan:
    # OWASP ZAP for DAST
    runs-on: ubuntu-latest
    steps:
      - uses: zaproxy/action-full-scan@v0.4.0
```

### 3. Set Severity Thresholds

Set appropriate severity thresholds:

```bash
# Good: Focus on high and critical
snyk test --severity-threshold=high
trivy image --severity HIGH,CRITICAL servio:latest

# Bad: Alert on everything
snyk test
trivy image servio:latest
```

### 4. Fix Vulnerabilities Promptly

Fix vulnerabilities quickly:

```yaml
# Block PRs with high vulnerabilities
- name: Check for high vulnerabilities
  run: |
    if [ $(snyk test --severity-threshold=high --json | jq '.vulnerabilities | length') -gt 0 ]; then
      echo "High severity vulnerabilities found"
      exit 1
    fi
```

### 5. Keep Tools Updated

Keep security tools updated:

```bash
# Update Snyk
snyk update

# Update Trivy database
trivy image --download-db-only

# Update OWASP ZAP
zap.sh -update
```

### 6. Test in Staging

Test security in staging environment:

```bash
# Scan staging environment
zap-baseline.py -t https://staging.servio.com -r report.html

# Don't scan production without authorization
# zap-baseline.py -t https://servio.com -r report.html
```

### 7. Document Findings

Document all security findings:

```markdown
# Security Scan Results - 2024-01-15

## Snyk Scan
- **Vulnerabilities Found**: 3
- **High Severity**: 1
- **Medium Severity**: 2
- **Recommendations**: Update lodash to 4.17.21

## Trivy Scan
- **Vulnerabilities Found**: 5
- **High Severity**: 2
- **Critical Severity**: 1
- **Recommendations**: Update base image to alpine:3.18

## OWASP ZAP Scan
- **Alerts**: 12
- **High Risk**: 2
- **Medium Risk**: 5
- **Recommendations**: Implement CSP headers
```

### 8. Automate Remediation

Automate vulnerability remediation:

```yaml
# Auto-fix vulnerabilities
- name: Auto-fix vulnerabilities
  run: |
    npm audit fix
    npm audit fix --force

# Update dependencies
- name: Update dependencies
  run: |
    npx npm-check-updates -u
    npm update
```

### 9. Monitor Security Alerts

Monitor security alerts continuously:

```yaml
# Set up security alerts
- name: Configure security alerts
  run: |
    # Snyk alerts
    snyk monitor --org=servio --project-name=servio-platform

    # GitHub Dependabot
    # Configure in GitHub settings
```

### 10. Educate Team

Educate team on security best practices:

```markdown
# Security Best Practices

## OWASP Top 10
1. **Injection**: Use parameterized queries
2. **Broken Authentication**: Implement strong authentication
3. **Sensitive Data Exposure**: Encrypt sensitive data
4. **XML External Entities**: Use safe XML parsers
5. **Broken Access Control**: Implement proper authorization
6. **Security Misconfiguration**: Secure default configurations
7. **Cross-Site Scripting (XSS)**: Sanitize user input
8. **Insecure Deserialization**: Validate serialized data
9. **Using Components with Known Vulnerabilities**: Update dependencies
10. **Insufficient Logging & Monitoring**: Implement comprehensive logging
```

## References

- [OWASP ZAP Documentation](https://www.zaproxy.org/docs/)
- [Burp Suite Documentation](https://portswigger.net/burp/documentation)
- [Snyk Documentation](https://snyk.io/docs/)
- [Trivy Documentation](https://aquasecurity.github.io/trivy/)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Security Testing Best Practices](https://owasp.org/www-community/)
