# Build context = repo root (see .github/workflows/build.yaml)
FROM oven/bun:1 AS builder

WORKDIR /app

# 安裝 workspace 依賴。frozen-lockfile 需要所有 workspace 成員的 manifest
# 才能解析依賴圖,因此三個 package.json 都要先 copy(僅 manifest,善用快取)。
COPY package.json bun.lock ./
COPY packages/shared/package.json packages/shared/package.json
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN bun install --frozen-lockfile

# 前端 API base 是編譯期注入(Astro 讀 import.meta.env.PUBLIC_API_BASE_URL)。
# 預設指向作者正式站;自架時由 compose 傳 build arg 覆蓋。
ARG PUBLIC_API_BASE_URL
ENV PUBLIC_API_BASE_URL=${PUBLIC_API_BASE_URL}

# 帶入原始碼並建置
COPY packages/shared packages/shared
COPY frontend frontend
RUN bun run --filter '@o-mai/frontend' build

FROM nginx:alpine
COPY --from=builder /app/frontend/dist /usr/share/nginx/html
EXPOSE 80
