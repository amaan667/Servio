#!/bin/bash

# Canary Deployment Script for Servio
# This script implements a canary deployment strategy with gradual traffic shifting

set -e

# Configuration
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
CANARY_PERCENTAGE="${CANARY_PERCENTAGE:-10}" # Start with 10% traffic
CANARY_PORT="${CANARY_PORT:-3002}"
STABLE_PORT="${STABLE_PORT:-3000}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:${CANARY_PORT}/api/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
MAX_CANARY_PERCENTAGE="${MAX_CANARY_PERCENTAGE:-100}"
CANARY_INCREMENT="${CANARY_INCREMENT:-10}"
ROLLBACK_ON_FAILURE="${ROLLBACK_ON_FAILURE:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Health check function
health_check() {
    local port=$1
    local url="http://localhost:${port}/api/health"
    local max_attempts=$((HEALTH_CHECK_TIMEOUT / HEALTH_CHECK_INTERVAL))
    local attempt=0

    log_info "Performing health check on ${url}..."

    while [ $attempt -lt $max_attempts ]; do
        if curl -sf "${url}" > /dev/null 2>&1; then
            log_success "Health check passed for port ${port}"
            return 0
        fi

        attempt=$((attempt + 1))
        log_info "Health check attempt ${attempt}/${max_attempts} failed, retrying in ${HEALTH_CHECK_INTERVAL}s..."
        sleep $HEALTH_CHECK_INTERVAL
    done

    log_error "Health check failed for port ${port} after ${max_attempts} attempts"
    return 1
}

# Build application
build_application() {
    log_info "Building application..."
    pnpm build

    if [ $? -ne 0 ]; then
        log_error "Build failed"
        exit 1
    fi

    log_success "Build completed successfully"
}

# Deploy canary instance
deploy_canary() {
    log_info "Deploying canary instance on port ${CANARY_PORT}..."

    # Stop existing canary process if running
    if lsof -Pi :${CANARY_PORT} -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_info "Stopping existing canary process on port ${CANARY_PORT}..."
        kill -9 $(lsof -Pi :${CANARY_PORT} -sTCP:LISTEN -t) 2>/dev/null || true
        sleep 2
    fi

    # Start canary process
    log_info "Starting canary application on port ${CANARY_PORT}..."
    PORT=${CANARY_PORT} pnpm start > /tmp/servio-canary.log 2>&1 &
    local pid=$!

    # Save PID for later cleanup
    echo $pid > /tmp/servio-canary.pid

    log_success "Canary application started on port ${CANARY_PORT} with PID ${pid}"
}

# Update traffic distribution
update_traffic_distribution() {
    local canary_percentage=$1

    log_info "Updating traffic distribution: ${canary_percentage}% to canary, $((100 - canary_percentage))% to stable..."

    # Update load balancer or reverse proxy configuration
    # This is a placeholder - actual implementation depends on your infrastructure
    # For example, with Nginx:
    # cat > /etc/nginx/sites-available/servio-canary << EOF
    # upstream servio_backend {
    #     server localhost:${STABLE_PORT} weight=$((100 - canary_percentage));
    #     server localhost:${CANARY_PORT} weight=${canary_percentage};
    # }
    # EOF
    # nginx -s reload

    log_success "Traffic distribution updated"
}

# Monitor canary deployment
monitor_canary() {
    local current_percentage=$1
    local target_percentage=$2

    log_info "Monitoring canary deployment at ${current_percentage}% traffic..."

    # Monitor for a period before increasing traffic
    local monitor_duration=60 # seconds
    local check_interval=10
    local checks=$((monitor_duration / check_interval))

    for i in $(seq 1 $checks); do
        log_info "Canary monitor check ${i}/${checks}..."

        # Check canary health
        if ! curl -sf "http://localhost:${CANARY_PORT}/api/health" > /dev/null 2>&1; then
            log_error "Canary health check failed during monitoring"
            return 1
        fi

        # Check error rates (placeholder - implement actual error rate monitoring)
        # local error_rate=$(get_error_rate)
        # if [ $(echo "$error_rate > 5" | bc -l) -eq 1 ]; then
        #     log_error "Error rate too high: ${error_rate}%"
        #     return 1
        # fi

        sleep $check_interval
    done

    log_success "Canary monitoring passed at ${current_percentage}% traffic"
    return 0
}

# Rollback canary deployment
rollback_canary() {
    log_warning "Initiating canary rollback..."

    # Switch all traffic back to stable
    update_traffic_distribution 0

    # Stop canary process
    if [ -f /tmp/servio-canary.pid ]; then
        local pid=$(cat /tmp/servio-canary.pid)
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid 2>/dev/null || true
        fi
        rm /tmp/servio-canary.pid
    fi

    log_success "Canary rollback completed successfully"
}

# Promote canary to stable
promote_canary() {
    log_info "Promoting canary to stable deployment..."

    # Switch all traffic to canary
    update_traffic_distribution 100

    # Update stable deployment
    # This would involve updating the stable deployment with the canary version
    # For example:
    # deploy_to_stable

    # Stop canary process (now it's the stable deployment)
    if [ -f /tmp/servio-canary.pid ]; then
        rm /tmp/servio-canary.pid
    fi

    log_success "Canary promoted to stable deployment successfully"
}

# Main canary deployment function
deploy_canary_release() {
    log_info "Starting canary deployment for ${DEPLOYMENT_ENV} environment..."

    # Build application
    build_application

    # Deploy canary instance
    deploy_canary

    # Perform initial health check
    if ! health_check $CANARY_PORT; then
        log_error "Initial health check failed on canary deployment"
        if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
            rollback_canary
        fi
        exit 1
    fi

    # Gradually increase traffic to canary
    local current_percentage=$CANARY_PERCENTAGE

    while [ $current_percentage -le $MAX_CANARY_PERCENTAGE ]; do
        log_info "Setting canary traffic to ${current_percentage}%..."

        # Update traffic distribution
        update_traffic_distribution $current_percentage

        # Monitor canary at current traffic level
        if ! monitor_canary $current_percentage $MAX_CANARY_PERCENTAGE; then
            log_error "Canary monitoring failed at ${current_percentage}% traffic"
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                rollback_canary
            fi
            exit 1
        fi

        # Increase traffic for next iteration
        current_percentage=$((current_percentage + CANARY_INCREMENT))

        # Don't exceed max percentage
        if [ $current_percentage -gt $MAX_CANARY_PERCENTAGE ]; then
            current_percentage=$MAX_CANARY_PERCENTAGE
        fi
    done

    # Promote canary to stable
    promote_canary

    log_success "Canary deployment completed successfully!"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy_canary_release
        ;;
    rollback)
        rollback_canary
        ;;
    promote)
        promote_canary
        ;;
    health-check)
        health_check ${2:-$CANARY_PORT}
        ;;
    status)
        echo "Canary port: ${CANARY_PORT}"
        echo "Stable port: ${STABLE_PORT}"
        echo "Current canary percentage: ${CANARY_PERCENTAGE}%"
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|promote|health-check|status}"
        echo ""
        echo "Environment variables:"
        echo "  DEPLOYMENT_ENV        - Deployment environment (default: production)"
        echo "  CANARY_PERCENTAGE     - Initial canary traffic percentage (default: 10)"
        echo "  CANARY_PORT          - Canary environment port (default: 3002)"
        echo "  STABLE_PORT          - Stable environment port (default: 3000)"
        echo "  HEALTH_CHECK_URL     - Health check URL (default: http://localhost:3002/api/health)"
        echo "  HEALTH_CHECK_TIMEOUT - Health check timeout in seconds (default: 300)"
        echo "  HEALTH_CHECK_INTERVAL - Health check interval in seconds (default: 5)"
        echo "  MAX_CANARY_PERCENTAGE - Maximum canary traffic percentage (default: 100)"
        echo "  CANARY_INCREMENT     - Traffic increment percentage (default: 10)"
        echo "  ROLLBACK_ON_FAILURE - Auto-rollback on failure (default: true)"
        exit 1
        ;;
esac
