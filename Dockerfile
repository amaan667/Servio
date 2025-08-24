# Use the official Node.js image as a base
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Install pnpm globally
RUN npm install -g pnpm

# Copy package files
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the rest of your application code
COPY . .

# Build the application
RUN pnpm build

# Expose the port your app runs on (Railway will override this)
EXPOSE 8080

# Command to run the application
CMD ["pnpm", "start"]