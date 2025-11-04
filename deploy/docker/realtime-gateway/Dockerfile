ARG NODE_VERSION=20.12.2

FROM node:${NODE_VERSION}-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat && corepack enable
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY services/realtime-gateway/package.json services/realtime-gateway/
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM base AS build
COPY services/realtime-gateway services/realtime-gateway
RUN pnpm -C services/realtime-gateway build
RUN --mount=type=cache,id=pnpm-store,target=/root/.local/share/pnpm/store \
    pnpm --filter ./services/realtime-gateway... deploy --prod --legacy /out

FROM node:${NODE_VERSION}-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/ ./
ENV PORT=4000
EXPOSE 4000
USER node
CMD ["npm","run","start"]
