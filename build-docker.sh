#!/bin/bash

# Build Docker image with BuildKit for caching support
echo "Building Docker image with caching..."

# Enable BuildKit for better caching
export DOCKER_BUILDKIT=1

# Build the image using the cached Dockerfile
docker build -f Dockerfile.cached -t servio-mvp:latest .

echo "Docker build completed!"
echo "To run the container: docker run -p 8080:8080 servio-mvp:latest"