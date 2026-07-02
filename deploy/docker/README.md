# Docker 部署

用 Docker Compose 跑一整套 maimai(前端 + 後端 + Postgres + 對外 tunnel + 推薦訓練)。
單一主機、一個指令起來。

> 要把現有的 k3s 部署搬過來的維護者,請看 [MIGRATION-from-k3s.md](./MIGRATION-from-k3s.md)。
> 下面是「從零部署一份」的說明。

## 需求

- Docker + Docker Compose v2
- 對外方式二擇一:Cloudflare Tunnel 的 token(免開埠),或到 VPS 用 Caddy(見最後一節)

## 快速開始

```sh
git clone git@github.com:oandy-rgb/o-mai-chart.git
cd o-mai-chart/deploy/docker

cp .env.example .env
# 產生兩組密鑰填進 .env:
openssl rand -base64 32   # → POSTGRES_PASSWORD
openssl rand -base64 32   # → JWT_SECRET
# TUNNEL_TOKEN 填 Cloudflare Tunnel 的 token;FRIEND_CODE_PEPPER 保留預設即可

docker compose up -d --build
docker compose ps
```

起來後驗證(本機除錯埠,僅綁 127.0.0.1):

```sh
curl -s http://127.0.0.1:3000/health                       # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/   # 200
```

正式流量走 cloudflared,不需開 host port。新設 tunnel 時,把 public hostname 指向
`http://maimai-frontend:80`(前端)與 `http://maimai-score:3000`(後端 API)即可。

> 從 k3s 搬過來的既有 tunnel,其 ingress 用的是 cluster FQDN
> (`maimai-score.maimai.svc.cluster.local` 等)。compose 已為兩個服務掛上對應的
> 網路別名,讓那組舊設定免改也能解析(見 compose 內 `networks.aliases`)。

## 服務組成

| 服務 | 說明 | 對外埠(僅 127.0.0.1) |
|---|---|---|
| `maimai-frontend` | Astro 靜態站(nginx) | `:8088` |
| `maimai-score` | 後端 API(Bun + Hono) | `:3000` |
| `maimai-postgres` | PostgreSQL 17 + 資料 volume | `:5432` |
| `cloudflared` | Cloudflare Tunnel 對外 | — |
| `maimai-recommend-trainer` | 每 30 分訓練推薦模型(k8s CronJob 的等價物) | — |

## 常用操作

```sh
docker compose logs -f maimai-score      # 看後端日誌
docker compose restart maimai-score      # 重啟單一服務
docker compose up -d --build             # 改了程式碼後重建並更新
docker compose down                      # 停止(保留資料 volume)
docker compose down -v                   # 停止並刪除資料(⚠️ 會清空 Postgres)
```

## 環境變數(.env)

| 變數 | 必填 | 說明 |
|---|---|---|
| `POSTGRES_PASSWORD` | ✅ | 新建 Postgres 的密碼(自訂) |
| `JWT_SECRET` | ✅ | 簽登入 token 的密鑰;換值會使既有登入失效 |
| `TUNNEL_TOKEN` | ✅* | Cloudflare Tunnel token(用 tunnel 對外時) |
| `FRIEND_CODE_PEPPER` | | 好友碼雜湊 pepper,預設 `dev-friend-code-pepper` |
| `ADMIN_EMAILS` | | 管理員 email(逗號分隔),用於別名審核等 admin API |
| `FRONTEND_ORIGIN` | | 允許的前端來源(CORS),預設 `https://mai.o-andy.com` |
| `PUBLIC_API_BASE_URL` | | 前端要打的後端網址(**編譯期**注入),預設 `https://api.o-andy.com` |
| `RECOMMEND_FACTORS` / `RECOMMEND_EPOCHS` | | 推薦模型訓練參數 |

## 要開一個「完全獨立」的實例(別人自架)

上面的預設值都是指向本專案作者的正式站。若要架**你自己的**一份,需自訂這幾處:

1. **Google OAuth client id**(登入用,寫死在兩處,需換成你自己的):
   - `backend/src/index.ts` 的 `GOOGLE_CLIENT_ID`
   - `frontend/src/layouts/Layout.astro`(`data-client_id` 與 `client_id`)
   在 Google Cloud Console 開一個 OAuth Web client,授權你的網域。
2. **後端網址**:`.env` 設 `PUBLIC_API_BASE_URL=https://你的-api-網域`(compose 已接 build arg)。
3. **前端來源**:`.env` 設 `FRONTEND_ORIGIN=https://你的-前端-網域`。
4. **Bookmarklet 網域**:`frontend/src/components/WelcomePage.tsx` 內的 `mai.o-andy.com`
   換成你的前端網域(它載入 `/sync.js`)。

> 若只是幫作者把服務部署到另一台(同網域、同 OAuth),以上都不用改,照「快速開始」即可。

## 待辦 / 已知限制

- **備份**:本 compose 沒有等同 CloudNativePG 的自動異地備份。正式營運請補一個
  `pg_dump → R2/S3` 的定時容器(可比照 `maimai-recommend-trainer` 的迴圈寫法)。
- **推薦訓練排程**:用 sleep 迴圈近似 cron;容器重啟會重算 30 分計時,無執行歷史。

## 上 VPS:改用 Caddy 對外(免 tunnel)

VPS 有公網 IP、80/443 是空的,可用 Caddy 自動 HTTPS 取代 cloudflared。
在 compose 加一個服務:

```yaml
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy-data:/data
    depends_on: [maimai-frontend, maimai-score]
# volumes: 區塊加 caddy-data:
```

`Caddyfile`(全部設定就這幾行,自動申請/續期 TLS):

```
你的前端網域   { reverse_proxy maimai-frontend:80 }
你的後端網域   { reverse_proxy maimai-score:3000 }
```

DNS 把兩個網域指到 VPS IP → `docker compose up -d` → 完成,連 cloudflared 都不用。
