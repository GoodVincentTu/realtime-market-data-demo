ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
# workspace manifests needed for resolution
COPY services/consumers/package.json services/consumers/
COPY services/orchestrator-api/package.json services/orchestrator-api/
COPY services/feeder/package.json services/feeder/
COPY frontend/dashboard/package.json frontend/dashboard/

# Install once for workspace (cached)
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
# copy only this package to build
COPY services/consumers services/consumers
RUN pnpm -C services/consumers build
# prune deps for runtime
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter ./services/consumers... deploy --prod --legacy /out

FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/ ./
# tiny supervisor to select worker by $WORKER (calc-a|calc-b)
COPY deploy/docker/consumers/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh && adduser -D -H app && chown -R app:app /app
USER app
# Expose only if you have metrics/HTTP; otherwise omit
EXPOSE 3101
CMD ["/entrypoint.sh"]
