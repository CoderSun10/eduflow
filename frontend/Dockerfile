# ─────────────────────────────────────────────────────────────────
# EduFlow Frontend - Production Dockerfile
# Multi-stage build: Node for building, Nginx for serving
# ─────────────────────────────────────────────────────────────────

# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci && npm cache clean --force

# Copy source and build
COPY . .
RUN npm run build

# Stage 2: Production
FROM nginx:alpine AS production

# Copy custom nginx config
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copy built assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:80/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
