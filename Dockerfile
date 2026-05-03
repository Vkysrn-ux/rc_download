FROM node:20-slim

# Chromium + system dependencies for Puppeteer (Debian Bookworm)
RUN apt-get update && apt-get install -y \
  chromium \
  ca-certificates \
  fonts-liberation \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnss3 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxkbcommon0 \
  libxrandr2 \
  libxss1 \
  xdg-utils \
  --no-install-recommends \
  && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer to use system Chromium instead of downloading its own
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# Install dependencies (cached layer)
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Copy source and build
COPY . .
RUN pnpm build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["pnpm", "start"]
