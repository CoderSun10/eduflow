# ─────────────────────────────────────────────────────────────────
# EduFlow Backend - Production Dockerfile
# Node.js 20 LTS with Alpine for smaller image size
# ─────────────────────────────────────────────────────────────────

FROM node:20-alpine AS base

WORKDIR /app

# Install production dependencies only
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application source
COPY src/ ./src/

RUN chmod -R 755 /app/src


# Set environment
ENV NODE_ENV=production
ENV PORT=4000

# Expose port
EXPOSE 4000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4000/api/health || exit 1

# Run as non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001
USER nodejs

# Start the application
CMD ["node", "src/server.js"]
