ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY services/orchestrator-api/package.json services/orchestrator-api/
COPY services/consumers/package.json services/consumers/
COPY services/feeder/package.json services/feeder/
COPY frontend/dashboard/package.json frontend/dashboard/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY services/orchestrator-api services/orchestrator-api
RUN pnpm -C services/orchestrator-api build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter ./services/orchestrator-api... deploy --prod /out

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/ ./
# if you serve OpenAPI via /api/v1/docs
ENV PORT=3030
EXPOSE 3030
USER node
CMD ["npm","run","start"]
