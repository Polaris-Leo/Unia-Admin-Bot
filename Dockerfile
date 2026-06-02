# Stage 1: Build frontend
FROM node:24-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install --no-fund --no-audit
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend dependencies (needs build tools for bcrypt native addon)
FROM node:24-alpine AS backend-builder
RUN apk add --no-cache python3 make g++
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev --no-fund --no-audit

# Stage 3: Production image
FROM node:24-alpine AS runner
WORKDIR /app/backend

COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 3001
VOLUME ["/app/backend/data"]

CMD ["node", "--no-warnings", "src/server.js"]
