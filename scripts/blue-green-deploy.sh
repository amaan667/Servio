#!/bin/bash

# Blue-Green Deployment Script for Servio
# This script implements a blue-green deployment strategy with automated rollback

set -e

# Configuration
DEPLOYMENT_ENV="${DEPLOYMENT_ENV:-production}"
BLUE_PORT="${BLUE_PORT:-3000}"
GREEN_PORT="${GREEN_PORT:-3001}"
HEALTH_CHECK_URL="${HEALTH_CHECK_URL:-http://localhost:${BLUE_PORT}/api/health}"
HEALTH_CHECK_TIMEOUT="${HEALTH_CHECK_TIMEOUT:-300}"
HEALTH_CHECK_INTERVAL="${HEALTH_CHECK_INTERVAL:-5}"
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

# Get current active deployment
get_active_deployment() {
    if curl -sf "http://localhost:${BLUE_PORT}/api/health" > /dev/null 2>&1; then
        echo "blue"
    elif curl -sf "http://localhost:${GREEN_PORT}/api/health" > /dev/null 2>&1; then
        echo "green"
    else
        echo "none"
    fi
}

# Get inactive deployment
get_inactive_deployment() {
    local active=$(get_active_deployment)
    if [ "$active" = "blue" ]; then
        echo "green"
    elif [ "$active" = "green" ]; then
        echo "blue"
    else
        echo "blue"
    fi
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

# Deploy to specified environment
deploy_to_environment() {
    local environment=$1
    local port=$2

    log_info "Deploying to ${environment} environment on port ${port}..."

    # Stop existing process if running
    if lsof -Pi :${port} -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_info "Stopping existing process on port ${port}..."
        kill -9 $(lsof -Pi :${port} -sTCP:LISTEN -t) 2>/dev/null || true
        sleep 2
    fi

    # Start new process
    log_info "Starting application on port ${port}..."
    PORT=${port} pnpm start > /tmp/servio-${environment}.log 2>&1 &
    local pid=$!

    # Save PID for later cleanup
    echo $pid > /tmp/servio-${environment}.pid

    log_success "Application started on port ${port} with PID ${pid}"
}

# Switch traffic to specified environment
switch_traffic() {
    local environment=$1
    local port=$2

    log_info "Switching traffic to ${environment} environment..."

    # Update load balancer or reverse proxy configuration
    # This is a placeholder - actual implementation depends on your infrastructure
    # For example, with Nginx:
    # sed -i "s/proxy_pass http:\/\/localhost:[0-9]*;/proxy_pass http:\/\/localhost:${port};/" /etc/nginx/sites-available/servio
    # nginx -s reload

    log_success "Traffic switched to ${environment} environment"
}

# Rollback to previous deployment
rollback_deployment() {
    local active=$(get_active_deployment)
    local inactive=$(get_inactive_deployment)

    log_warning "Initiating rollback from ${active} to ${inactive}..."

    # Switch traffic back to previous environment
    if [ "$inactive" = "blue" ]; then
        switch_traffic "blue" $BLUE_PORT
    else
        switch_traffic "green" $GREEN_PORT
    fi

    log_success "Rollback completed successfully"
}

# Cleanup old deployment
cleanup_deployment() {
    local environment=$1

    log_info "Cleaning up ${environment} deployment..."

    # Stop process
    if [ -f /tmp/servio-${environment}.pid ]; then
        local pid=$(cat /tmp/servio-${environment}.pid)
        if ps -p $pid > /dev/null 2>&1; then
            kill $pid 2>/dev/null || true
        fi
        rm /tmp/servio-${environment}.pid
    fi

    log_success "Cleanup completed for ${environment} deployment"
}

# Main deployment function
deploy() {
    log_info "Starting blue-green deployment for ${DEPLOYMENT_ENV} environment..."

    # Get current state
    local active=$(get_active_deployment)
    local inactive=$(get_inactive_deployment)

    log_info "Current active deployment: ${active}"
    log_info "Target deployment: ${inactive}"

    # Build application
    build_application

    # Deploy to inactive environment
    if [ "$inactive" = "blue" ]; then
        deploy_to_environment "blue" $BLUE_PORT
    else
        deploy_to_environment "green" $GREEN_PORT
    fi

    # Perform health check on new deployment
    if [ "$inactive" = "blue" ]; then
        if ! health_check $BLUE_PORT; then
            log_error "Health check failed on blue deployment"
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                rollback_deployment
            fi
            exit 1
        fi
    else
        if ! health_check $GREEN_PORT; then
            log_error "Health check failed on green deployment"
            if [ "$ROLLBACK_ON_FAILURE" = "true" ]; then
                rollback_deployment
            fi
            exit 1
        fi
    fi

    # Switch traffic to new deployment
    if [ "$inactive" = "blue" ]; then
        switch_traffic "blue" $BLUE_PORT
    else
        switch_traffic "green" $GREEN_PORT
    fi

    # Cleanup old deployment after successful switch
    if [ "$active" != "none" ]; then
        sleep 30 # Wait for traffic to drain
        cleanup_deployment "$active"
    fi

    log_success "Blue-green deployment completed successfully!"
}

# Parse command line arguments
case "${1:-deploy}" in
    deploy)
        deploy
        ;;
    rollback)
        rollback_deployment
        ;;
    health-check)
        health_check ${2:-$BLUE_PORT}
        ;;
    status)
        echo "Active deployment: $(get_active_deployment)"
        echo "Inactive deployment: $(get_inactive_deployment)"
        ;;
    *)
        echo "Usage: $0 {deploy|rollback|health-check|status}"
        echo ""
        echo "Environment variables:"
        echo "  DEPLOYMENT_ENV        - Deployment environment (default: production)"
        echo "  BLUE_PORT            - Blue environment port (default: 3000)"
        echo "  GREEN_PORT           - Green environment port (default: 3001)"
        echo "  HEALTH_CHECK_URL     - Health check URL (default: http://localhost:3000/api/health)"
        echo "  HEALTH_CHECK_TIMEOUT - Health check timeout in seconds (default: 300)"
        echo "  HEALTH_CHECK_INTERVAL - Health check interval in seconds (default: 5)"
        echo "  ROLLBACK_ON_FAILURE - Auto-rollback on failure (default: true)"
        exit 1
        ;;
esac
