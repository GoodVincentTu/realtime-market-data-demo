# ---------- builder (monorepo-aware) ----------
FROM node:20-alpine AS build
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable

# Copy root manifests for pnpm workspace resolution/caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Copy only the dashboard package.json first to leverage Docker layer cache
COPY frontend/dashboard/package.json frontend/dashboard/

# Install deps for the workspace (cached until manifests change)
RUN pnpm install --frozen-lockfile

# Bring in the rest of the source (monorepo)
COPY . .

# Build-time env for Vite (override via --build-arg)
ARG VITE_API_BASE_URL=https://example.invalid
ARG VITE_REALTIME_URL=https://example.invalid/realtime/ticks
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_REALTIME_URL=${VITE_REALTIME_URL}

# Build only the dashboard package
RUN pnpm --filter @realtime/dashboard build

# ---------- runtime (nginx) ----------
FROM nginx:1.27-alpine AS runner
WORKDIR /usr/share/nginx/html

# Needed for envsubst in entrypoint
RUN apk add --no-cache gettext

# Copy built static assets
COPY --from=build /app/frontend/dashboard/dist ./

# Nginx templated config + entrypoint honoring $PORT
COPY deploy/docker/dashboard/default.conf.template /etc/nginx/conf.d/default.conf.template
COPY deploy/docker/dashboard/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Informational default (platforms like Render set PORT)
EXPOSE 8080
CMD ["/entrypoint.sh"]