# ─── Stage 1: Build ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Install dependencies first (leverage Docker cache)
COPY package.json package-lock.json* ./
RUN npm ci --ignore-scripts

# Copy source and build
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# ─── Stage 2: Production Runtime ─────────────────────────────────────────────
FROM node:22-slim AS runtime

# Security: create non-root user
RUN groupadd -g 1001 appgroup && \
    useradd -m -u 1001 -g appgroup -s /usr/sbin/nologin appuser

WORKDIR /app

# Install production dependencies only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev --ignore-scripts && \
    npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist
COPY web/ ./web/

# Set ownership
RUN chown -R appuser:appgroup /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/node/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Start
CMD ["node", "dist/server.js"]
