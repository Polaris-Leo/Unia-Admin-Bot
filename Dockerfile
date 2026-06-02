# Stage 1: Build frontend
FROM node:24-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Install backend dependencies (needs build tools for bcrypt native addon)
FROM node:24-slim AS backend-builder
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm install --omit=dev

# Stage 3: Production image
FROM node:24-slim AS runner
WORKDIR /app/backend

COPY --from=backend-builder /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=frontend-builder /app/frontend/dist /app/frontend/dist

EXPOSE 3001
VOLUME ["/app/backend/data"]

CMD ["node", "--no-warnings", "src/server.js"]
