# Docker Setup Guide

This guide explains how to set up Servio using Docker for local development.

## Prerequisites

- Docker Desktop or Docker Engine 20.10+
- Docker Compose 2.0+
- At least 4GB RAM available
- At least 10GB disk space available

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/amaan667/Servio.git
cd Servio
```

### 2. Configure Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` with your values:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe Configuration
STRIPE_SECRET_KEY=sk_test_your-secret-key
STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your-publishable-key

# Optional: OpenAI
OPENAI_API_KEY=sk-your-openai-key

# Optional: Sentry
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

### 3. Start Services

```bash
docker-compose up -d
```

This will start:
- **Servio App** on `http://localhost:3000`
- **Redis** on `localhost:6379`
- **PostgreSQL** on `localhost:5432` (optional)
- **pgAdmin** on `http://localhost:5050` (optional)
- **Redis Commander** on `http://localhost:8081` (optional)

### 4. Access the Application

Open your browser and navigate to:
```
http://localhost:3000
```

## Development Workflow

### View Logs

```bash
# View all logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f app
docker-compose logs -f redis
```

### Stop Services

```bash
# Stop all services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

### Restart Services

```bash
docker-compose restart app
```

### Rebuild Services

```bash
# Rebuild and restart
docker-compose up -d --build

# Rebuild specific service
docker-compose up -d --build app
```

## Service Details

### Servio App

- **Port**: 3000
- **URL**: http://localhost:3000
- **Health Check**: http://localhost:3000/api/health
- **Environment**: Development

### Redis

- **Port**: 6379
- **Purpose**: Caching and rate limiting
- **Management UI**: http://localhost:8081 (Redis Commander)
- **Data Persistence**: Yes (volume: `redis-data`)

### PostgreSQL (Optional)

- **Port**: 5432
- **Database**: `servio_dev`
- **User**: `postgres`
- **Password**: `postgres`
- **Management UI**: http://localhost:5050 (pgAdmin)
  - **Email**: admin@servio.local
  - **Password**: admin
- **Data Persistence**: Yes (volume: `postgres-data`)

**Note**: PostgreSQL is optional. Use Supabase for production.

## Troubleshooting

### Port Already in Use

**Error**: `Bind for 0.0.0.0:3000 failed: port is already allocated`

**Solution**:
```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in docker-compose.yml
ports:
  - "3001:3000"
```

### Container Won't Start

**Error**: Container exits immediately

**Solution**:
```bash
# Check container logs
docker-compose logs app

# Check for missing environment variables
docker-compose config

# Verify .env file exists
ls -la .env
```

### Out of Memory

**Error**: Container killed due to OOM

**Solution**:
```bash
# Increase Docker memory limit
# Docker Desktop → Settings → Resources → Memory

# Or reduce Node.js memory in docker-compose.yml
environment:
  - NODE_OPTIONS=--max-old-space-size=2048
```

### Database Connection Issues

**Error**: Cannot connect to database

**Solution**:
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Test connection
docker-compose exec postgres psql -U postgres -d servio_dev -c "SELECT 1"
```

### Redis Connection Issues

**Error**: Cannot connect to Redis

**Solution**:
```bash
# Check if Redis is running
docker-compose ps redis

# Check Redis logs
docker-compose logs redis

# Test connection
docker-compose exec redis redis-cli ping
# Should return: PONG
```

### Build Failures

**Error**: Build fails during `docker-compose build`

**Solution**:
```bash
# Clear Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache

# Check for syntax errors in Dockerfile
docker build -t servio-test .
```

## Advanced Usage

### Running Tests in Docker

```bash
# Run unit tests
docker-compose exec app pnpm test

# Run E2E tests
docker-compose exec app pnpm test:e2e

# Run tests with coverage
docker-compose exec app pnpm test:coverage
```

### Database Migrations

```bash
# Run migrations
docker-compose exec app pnpm migrate

# Create new migration
docker-compose exec app pnpm migrate:create
```

### Accessing Container Shell

```bash
# Access app container
docker-compose exec app sh

# Access Redis container
docker-compose exec redis sh

# Access PostgreSQL container
docker-compose exec postgres sh
```

### Custom Configuration

#### Change Ports

Edit `docker-compose.yml`:

```yaml
services:
  app:
    ports:
      - "3001:3000"  # Use port 3001 instead
```

#### Add Environment Variables

Edit `docker-compose.yml`:

```yaml
services:
  app:
    environment:
      - CUSTOM_VAR=value
      - ANOTHER_VAR=another-value
```

#### Disable Optional Services

Edit `docker-compose.yml` and comment out services:

```yaml
# services:
#   postgres:
#     ...
#   pgadmin:
#     ...
#   redis-commander:
#     ...
```

## Production Deployment

### Build Production Image

```bash
# Build production image
docker build -t servio:latest --target production .

# Tag for registry
docker tag servio:latest your-registry/servio:latest

# Push to registry
docker push your-registry/servio:latest
```

### Production Docker Compose

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  app:
    image: your-registry/servio:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - NEXT_PUBLIC_APP_URL=https://your-app.com
      # ... other production env vars
    restart: always
```

Run production compose:

```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Tips

### Use BuildKit

```bash
export DOCKER_BUILDKIT=1
docker-compose build
```

### Use Multi-Stage Builds

The Dockerfile already uses multi-stage builds for:
- Smaller image size
- Faster builds
- Better caching

### Volume Mounts

For development, mount source code as volume:

```yaml
volumes:
  - .:/app
  - /app/node_modules  # Prevent overwriting node_modules
```

### Resource Limits

Add resource limits to `docker-compose.yml`:

```yaml
services:
  app:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
        reservations:
          cpus: '1'
          memory: 2G
```

## Cleanup

### Remove All Containers and Volumes

```bash
docker-compose down -v
```

### Remove Docker System Cache

```bash
docker system prune -a
```

### Remove Unused Images

```bash
docker image prune -a
```

## Useful Commands

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Rebuild services
docker-compose up -d --build

# Execute command in container
docker-compose exec app <command>

# View running containers
docker-compose ps

# View resource usage
docker stats
```

## Getting Help

If you encounter issues:

1. Check [troubleshooting guide](TROUBLESHOOTING.md)
2. Review [Docker documentation](https://docs.docker.com/)
3. Check [Docker Compose documentation](https://docs.docker.com/compose/)
4. Open an [issue](https://github.com/amaan667/Servio/issues)
