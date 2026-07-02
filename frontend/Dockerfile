# Build context = repo root (see .github/workflows/build.yaml)
FROM oven/bun:1 AS builder

WORKDIR /app

# 安裝 workspace 依賴(先只 copy manifest 以善用快取)
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json
RUN bun install --frozen-lockfile

# 帶入原始碼並建置
COPY packages/shared packages/shared
COPY frontend frontend
RUN bun --filter @o-mai/frontend run build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
