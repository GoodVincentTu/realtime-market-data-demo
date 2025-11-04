ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY services/feeder/package.json services/feeder/
COPY services/orchestrator-api/package.json services/orchestrator-api/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY services/feeder services/feeder
RUN pnpm -C services/feeder build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter ./services/feeder... deploy --prod /out

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/ ./
USER node
EXPOSE 3200
CMD ["npm","run","start"]