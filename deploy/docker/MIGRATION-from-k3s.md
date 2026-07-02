# k3s → Docker 遷移 runbook

> 這份文件是**一次性**的:把原本跑在單機 k3s(Flux GitOps + CloudNativePG)的
> maimai,搬到本目錄的 Docker Compose 部署。只有維護者(遷移那台機器的人)會用到。
> 純粹想部署一份新實例的人請看 [README.md](./README.md),不需要這份。

服務名稱刻意與 k3s Service DNS 一致(`maimai-frontend`、`maimai-score`),
因此既有的 cloudflared **token tunnel** 可直接沿用,Cloudflare 端不需變更。

> ⚠️ k3s 正跑正式服務、Postgres 有真實資料。Flux 每 10 分鐘 reconcile 且 `prune: true`
> ——**若不先 suspend Flux,手動縮容的 pod 會在 10 分鐘內被復原**,造成雙 tunnel
> 搶流量。務必照順序做。

## 取得既有 tunnel token(填入 .env 的 TUNNEL_TOKEN)

```sh
kubectl -n maimai get secret cloudflared-token -o jsonpath='{.data.token}' | base64 -d
```
（或在切換當下於 Cloudflare 儀表板 Refresh token 換一組新的,見下方 Step 4。）

## 前置

```sh
cd deploy/docker
cp .env.example .env
# 填入:POSTGRES_PASSWORD(新設)、JWT_SECRET、ADMIN_EMAILS
# FRIEND_CODE_PEPPER 保留預設 dev-friend-code-pepper(維持好友身分連續性)
# TUNNEL_TOKEN 等 Step 4 換 token 時再填
docker compose build
```

## Step 1 — 凍結 Flux(避免復原被縮容的 workload)

```sh
flux suspend kustomization maimai-frontend maimai-score
# cloudflared 歸 maimai-score kustomization 管,一併涵蓋
# maimai-postgres 先不 suspend——遷移時還要從它 dump
```

## Step 2 — 停掉 k3s 應用寫入來源(此刻起 mai/api 短暫中斷)

```sh
kubectl -n maimai patch cronjob maimai-recommend-model -p '{"spec":{"suspend":true}}'
kubectl -n maimai scale deploy maimai-score maimai-frontend cloudflared --replicas=0
kubectl -n maimai rollout status deploy/maimai-score --timeout=60s 2>/dev/null || true
```

## Step 3 — 從 k3s Postgres dump,匯入 Docker Postgres

```sh
# 先只起 docker 的 postgres(空庫)
docker compose up -d maimai-postgres
docker compose exec maimai-postgres sh -c 'until pg_isready -U maimai; do sleep 1; done'

# 從 CNPG 取連線字串並 dump(在 CNPG pod 內執行,pg_dump 版本相符)
K8S_URI=$(kubectl -n maimai get secret maimai-postgres-app -o jsonpath='{.data.uri}' | base64 -d)
kubectl -n maimai exec maimai-postgres-1 -- \
  pg_dump -d "$K8S_URI" --no-owner --no-privileges > maimai-dump.sql

# 匯入 docker postgres
docker compose exec -T maimai-postgres psql -v ON_ERROR_STOP=1 -U maimai -d maimai < maimai-dump.sql

# 抽查筆數(跟 k3s 側比對)
docker compose exec maimai-postgres psql -U maimai -d maimai \
  -c 'select (select count(*) from player) players, (select count(*) from score) scores;'
```

## Step 4 — 換 tunnel token,起 Docker 全棧接管

```sh
# (1) 在 Cloudflare 儀表板 Refresh token,複製新 token
# (2) 貼進 deploy/docker/.env 的 TUNNEL_TOKEN=
# (3) 起全棧(cloudflared 帶新 token 連上,tunnel 立即接管)
docker compose up -d
docker compose ps

# 本機驗證(繞過 tunnel)
curl -s http://127.0.0.1:3000/health          # {"status":"ok"}
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:8088/
```

換 token 後舊 k3s connector 的 token 即失效,不會與新的搶線。

## Step 5 — 驗證正式網域

```sh
curl -s https://api.o-andy.com/health
curl -s -o /dev/null -w '%{http_code}\n' https://mai.o-andy.com/
```

登入一次(Google)確認 JWT 正常。→ 全綠即遷移完成。

## 回滾(Step 5 驗證失敗時)

Docker 期間寫入的資料會捨棄;k3s Postgres 全程只讀,未受影響,可安全回滾。

```sh
# 若已 Refresh token,需把新 token 也寫回 k3s 的 SOPS secret 再復原:
#   sops ../../..（infra repo）/services/maimai-score/cloudflared.enc.env
docker compose down
kubectl -n maimai scale deploy maimai-score maimai-frontend cloudflared --replicas=1
kubectl -n maimai patch cronjob maimai-recommend-model -p '{"spec":{"suspend":false}}'
flux resume kustomization maimai-frontend maimai-score
```

## 永久下線 k3s(觀察數日、確認穩定後)

Flux `prune: true`,手動刪除會被復原。正式下線要**從 infra git repo** 移除
`maimai-frontend`、`maimai-score` 的 Kustomization(讓 Flux prune),或持續 `flux suspend`。

`maimai-postgres` 建議**最後**再處理:先確認 Docker 側資料無誤、並已有新的備份機制後
再下線;下線前保留 CNPG 的 R2 barman 備份作為安全網。

## 已知事項

- **JWT_SECRET 若與 k3s 不同**:既有登入 token 失效,使用者需重新 Google 登入(低摩擦)。
  k3s 版未設 JWT_SECRET(用 dev 預設),Docker 版設了真值 → 屬預期且更安全。
- **FRIEND_CODE_PEPPER**:保留 `dev-friend-code-pepper`(k3s 實際使用值),
  好友身分才能對應到日後新提交的好友碼。
- **備份**:Docker 版沒有 CNPG 的 R2 barman 自動備份,遷移後請補上(見 README 的待辦)。
