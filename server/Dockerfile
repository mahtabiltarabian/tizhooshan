# Production image of the API. Build from the REPOSITORY ROOT (the server
# imports the app's shared code in ../src):
#   docker build -f server/Dockerfile -t tizhooshan-api .

FROM node:20-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY server/package.json server/package-lock.json server/
RUN cd server && npm ci
# The shared files in ../src resolve packages (react, @types/react) from here.
RUN ln -s server/node_modules node_modules
COPY src ./src
COPY server ./server
RUN cd server && npm run build && npm prune --omit=dev

FROM node:20-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production PORT=3200 TZ=Asia/Tehran
WORKDIR /app/server
COPY --from=build /app/server/package.json ./
COPY --from=build /app/server/node_modules ./node_modules
COPY --from=build /app/server/prisma ./prisma
COPY --from=build /app/server/dist ./dist
USER node
EXPOSE 3200
# Apply pending migrations, then serve.
CMD ["sh", "-c", "./node_modules/.bin/prisma migrate deploy && exec node dist/server/src/main.js"]
