# Use Node.js 20 Alpine as base image
FROM node:20-alpine

# Install poppler-utils for PDF to image conversion
RUN apk add --no-cache poppler-utils

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN corepack enable && corepack prepare pnpm@latest --activate && \
    pnpm install --frozen-lockfile

# Copy application code
COPY . .

# Build the application
RUN NODE_NO_WARNINGS=1 pnpm run build

# Expose port
EXPOSE 8080

# Start the application
CMD ["pnpm", "start"]

