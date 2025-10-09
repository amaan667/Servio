# Use Node.js 20 LTS
FROM node:20-alpine

# Install pnpm
RUN npm install -g pnpm@9.15.9

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build the application
RUN NODE_NO_WARNINGS=1 pnpm run build

# Expose port
EXPOSE 3000

# Start the application
CMD ["pnpm", "start"]
