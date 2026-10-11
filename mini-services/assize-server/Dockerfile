# ASSIZE authoritative duel server.
#
# Build context is the REPO ROOT (the server imports ../../shared/*), so deploy with:
#   fly deploy --config mini-services/assize-server/fly.toml .        # from the repo root
# or with plain docker:
#   docker build -f mini-services/assize-server/Dockerfile -t assize-server .
#   docker run -p 3030:3030 -v assize-data:/data -e ASSIZE_DB=/data/assize.db assize-server
FROM oven/bun:1.2 AS runner

WORKDIR /app/mini-services/assize-server

# Dependencies first: the mini-service lockfile changes far less often than game code,
# so this layer stays warm between deploys.
COPY mini-services/assize-server/package.json mini-services/assize-server/bun.lock* ./
COPY shared /app/shared
RUN bun install --frozen-lockfile --production

COPY mini-services/assize-server/index.ts mini-services/assize-server/db.ts ./

ENV NODE_ENV=production
EXPOSE 3030
CMD ["bun", "index.ts"]
