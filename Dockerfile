FROM node:24-bookworm-slim AS build
WORKDIR /app

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

COPY package.json package-lock.json .npmrc ./
RUN npm ci

COPY . .

ARG GIT_SHA=unknown

RUN --mount=type=secret,id=app_key,required=false \
    --mount=type=secret,id=sentry_auth_token,required=false \
    APP_KEY="$(cat /run/secrets/app_key 2>/dev/null || true)" \
    DATABASE_URL="file:/tmp/build.db" \
    SENTRY_AUTH_TOKEN="$(cat /run/secrets/sentry_auth_token 2>/dev/null || true)" \
    npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production
EXPOSE 3000

COPY package.json package-lock.json .npmrc ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/build ./build
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/tsconfig.json ./tsconfig.json

COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./

USER node
CMD ["node", "build"]
