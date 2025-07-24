# Use official Node.js 20 image
FROM node:20

# Install poppler-utils for pdf-poppler
RUN apt-get update && apt-get install -y poppler-utils

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

# Build the Next.js app
RUN npm run build

# Expose port (change if your app uses a different port)
EXPOSE 8080

# Start the app
COPY write-vision-key.sh /app/write-vision-key.sh
RUN chmod +x /app/write-vision-key.sh

CMD ["/app/write-vision-key.sh"] 