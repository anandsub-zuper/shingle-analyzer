FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
COPY .npmrc ./

RUN npm install --production

COPY . .

ENV PORT=8080
EXPOSE 8080

CMD ["node", "test-server.js"]
