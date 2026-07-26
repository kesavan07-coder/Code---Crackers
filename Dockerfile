# Production Dockerfile for Code Crackers Backend
FROM node:20-alpine

WORKDIR /app

# Copy package definition & install dependencies
COPY backend/package*.json ./
RUN npm install

# Copy source code and build TypeScript
COPY backend/ ./
RUN npm run build

# Expose backend port
EXPOSE 5000

# Start compiled server
CMD ["npm", "start"]
