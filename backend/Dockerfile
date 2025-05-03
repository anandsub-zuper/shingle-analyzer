# Build stage with a newer Ubuntu that has the required GLIBC version
FROM ubuntu:22.04 as builder

# Install Node.js
RUN apt-get update && apt-get install -y curl
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
RUN apt-get install -y nodejs

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY .npmrc ./
RUN npm install --production

# Copy the rest of the application
COPY . .

# Final stage with minimal Alpine Linux
FROM alpine:3.18

# Install Node.js in Alpine
RUN apk add --update nodejs

WORKDIR /app

# Copy node_modules and all other files from the builder stage
COPY --from=builder /app /app

# Set environment variables
ENV PORT=8080
ENV NODE_ENV=production

# Expose the port
EXPOSE 8080

# Start the server
CMD ["node", "test-server.js"]
