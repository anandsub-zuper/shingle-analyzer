# Build stage
FROM node:18-bookworm as build

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./

RUN npm install --production

COPY . .

# Final stage
FROM gcr.io/distroless/nodejs18-debian12

WORKDIR /app

# Copy node_modules and all other files
COPY --from=build /app /app

ENV PORT=8080
EXPOSE 8080

CMD ["test-server.js"]
