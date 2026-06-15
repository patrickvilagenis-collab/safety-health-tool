FROM node:22-bookworm-slim

# Build tools so better-sqlite3 compiles if a prebuilt binary isn't available.
RUN apt-get update && apt-get install -y --no-install-recommends python3 build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev

COPY . .

ENV PORT=8080
EXPOSE 8080
VOLUME /app/data
CMD ["node", "server.js"]
