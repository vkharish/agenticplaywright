FROM node:20-bookworm-slim

# curl is needed for the healthcheck in docker-compose
RUN apt-get update && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install all deps (devDeps needed for tsc)
COPY package.json package-lock.json* ./
RUN npm ci

# Compile TypeScript
COPY tsconfig.json ./
COPY src/ ./src/
RUN npm run build

# Download Chromium + all its system dependencies
RUN npx playwright install chromium --with-deps

# Drop devDeps from the final layer
RUN npm prune --omit=dev

EXPOSE 3000
ENV NODE_ENV=production
CMD ["node", "dist/src/index.js"]
