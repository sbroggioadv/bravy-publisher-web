FROM node:22-bookworm-slim AS base
RUN corepack enable && corepack prepare pnpm@11.11.0 --activate
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV PNPM_CONFIG_DANGEROUSLY_ALLOW_ALL_BUILDS=true

FROM base AS build
COPY . .
RUN pnpm install --frozen-lockfile
ENV NEXT_PUBLIC_API_URL=https://api.publisher.iacombativa.com/api/v1
# Staging: fala com API real (auth/upload/studio). Geração IA ainda depende de ANTHROPIC_API_KEY real.
ENV NEXT_PUBLIC_MOCK=false
RUN cd packages/scene-engine && npm install --no-audit --no-fund && npm run build
RUN pnpm build

FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_PUBLIC_API_URL=https://api.publisher.iacombativa.com/api/v1
ENV NEXT_PUBLIC_MOCK=false
COPY --from=build /app ./
EXPOSE 3000
CMD ["sh", "-c", "pnpm exec next start --hostname 0.0.0.0 --port ${PORT}"]
