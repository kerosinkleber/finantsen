# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
# Speicher: Node richtet sich sonst nach dem gesamten RAM des Rechners (NAS mit 8 GB → späte Aufräumarbeit, hohe
# Spitzen). Mit 256 MB Obergrenze für den Heap sanken die Spitzen in Messungen um gut 40 % (397 → 226 MB bei 20
# gleichzeitigen Zugriffen), ohne Geschwindigkeitsverlust; abgestürzt ist erst unter 96 MB. Siehe docs/performance.md.
# Überschreibbar per Umgebungsvariable NODE_OPTIONS (z. B. in der .env/compose: NODE_OPTIONS=--max-old-space-size=512).
ENV NODE_OPTIONS=--max-old-space-size=256
RUN useradd --system --uid 1001 app
COPY --from=build --chown=app /app/.next/standalone ./
COPY --from=build --chown=app /app/.next/static ./.next/static
COPY --from=build --chown=app /app/public ./public
# SQL-Migrationen: werden beim Start automatisch angewendet (src/instrumentation.ts)
COPY --from=build --chown=app /app/drizzle ./drizzle
USER app
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
