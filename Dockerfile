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

# Set placeholder environment variables for build time
ENV NEXT_PUBLIC_SUPABASE_URL=https://placeholder.supabase.co
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=placeholder_key
ENV NEXT_PUBLIC_APP_URL=https://placeholder-app.railway.app
ENV NEXT_PHASE=phase-production-build

# Build the application (with debug output)
RUN echo "Building with placeholder environment variables..." && \
    echo "NEXT_PUBLIC_SUPABASE_URL: $NEXT_PUBLIC_SUPABASE_URL" && \
    echo "NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL" && \
    echo "NEXT_PHASE: $NEXT_PHASE" && \
    pnpm build

# Expose the port your app runs on (Railway will override this)
EXPOSE 8080

# Command to run the application
CMD ["pnpm", "start"]