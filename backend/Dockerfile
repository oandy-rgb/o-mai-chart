# Build context = repo root (see .github/workflows/build.yaml)
FROM oven/bun:1

WORKDIR /app

# 安裝 workspace 依賴(先只 copy manifest 以善用快取)
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY backend/package.json backend/package.json
RUN bun install --frozen-lockfile

# 帶入原始碼
COPY packages/shared packages/shared
COPY backend backend

WORKDIR /app/backend
EXPOSE 3000
CMD ["bun", "run", "src/index.ts"]
