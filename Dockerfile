# Use the official Node.js image as a base
FROM node:18

# Install system dependencies for pdf2pic
RUN apt-get update && \
    apt-get install -y imagemagick graphicsmagick && \
    rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your app
COPY . .

# Build your Next.js app
RUN npm run build

# Expose the port Railway will use
EXPOSE 8080

# Start the app using Next.js standalone output
CMD ["node", ".next/standalone/server.js"] 