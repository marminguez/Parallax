# Parallax web app: the search, missions, campaign and public pages, with the measured
# index bundled (no data download). Live evaluation (Python engine + local rasters) is
# not included; see the README.
#
#   docker build -t parallax ./web
#   docker run --rm -p 3000:3000 parallax      ->  http://localhost:3000

FROM node:22-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PARALLAX_STANDALONE=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN groupadd --system parallax && useradd --system --gid parallax --no-create-home parallax
COPY --from=build --chown=parallax:parallax /app/.next/standalone ./
COPY --from=build --chown=parallax:parallax /app/.next/static ./.next/static
COPY --from=build --chown=parallax:parallax /app/public ./public
COPY --from=build --chown=parallax:parallax /app/data ./data
USER parallax
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
