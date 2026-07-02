# o-mai-chart

maimai 成績追蹤系統的 monorepo(Bun workspaces)。

## 結構

```
o-mai-chart/
├── frontend/          # Astro + Preact 前端 (@o-mai/frontend)
├── backend/           # Bun + Hono + PostgreSQL API (@o-mai/backend)
└── packages/
    └── shared/        # 前後端共用的 rating / rank / version 邏輯 (@o-mai/shared)
```

## 開發

```sh
bun install            # 安裝所有 workspace 依賴

bun run dev:frontend   # 前端 dev server (localhost:4321)
bun run dev:backend    # 後端 API (localhost:3000)
bun run build:frontend # 建置前端到 frontend/dist
bun run train:recommend # 訓練推薦模型
```

也可直接進各子目錄執行原本的指令(`cd frontend && bun run dev`)。

## 環境變數

- 後端:`DATABASE_URL`、`JWT_SECRET`(production 必填)、`FRIEND_CODE_PEPPER`、`ADMIN_EMAILS`
- 前端:`PUBLIC_API_BASE_URL`(預設 `https://api.o-andy.com`)

## 建置與部署

CI(`.github/workflows/build.yaml`)在 push 到 `main` 時,依變動路徑分別 build
`backend/Dockerfile`、`frontend/Dockerfile`(build context = repo 根),推送到 ghcr.io。
改動 `packages/shared` 會同時觸發兩者重建。
