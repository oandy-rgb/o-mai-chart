#!/bin/sh
# 定時 pg_dump → 上傳 Cloudflare R2(S3 相容)→ 清掉過期備份。
# 透明、可讀;要改保留天數/頻率改 .env 即可。
set -eu

: "${DATABASE_URL:?need DATABASE_URL}"
: "${R2_ACCESS_KEY_ID:?need R2_ACCESS_KEY_ID}"
: "${R2_SECRET_ACCESS_KEY:?need R2_SECRET_ACCESS_KEY}"
: "${R2_ENDPOINT:?need R2_ENDPOINT (https://<account>.r2.cloudflarestorage.com)}"
: "${R2_BUCKET:?need R2_BUCKET}"
R2_PREFIX="${R2_PREFIX:-docker-dumps}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"
INTERVAL="${BACKUP_INTERVAL:-86400}"

# rclone 用「即時 S3 backend」(:s3:),不需設定檔;憑證走旗標。
rc() {
  rclone \
    --s3-provider Cloudflare \
    --s3-access-key-id "$R2_ACCESS_KEY_ID" \
    --s3-secret-access-key "$R2_SECRET_ACCESS_KEY" \
    --s3-endpoint "$R2_ENDPOINT" \
    "$@"
}

backup_once() {
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  file="maimai-${ts}.sql.gz"
  echo "[backup] $ts dumping..."
  pg_dump "$DATABASE_URL" --no-owner --no-privileges | gzip > "/tmp/$file"
  echo "[backup] uploading $file ($(du -h "/tmp/$file" | cut -f1)) → r2:$R2_BUCKET/$R2_PREFIX/"
  rc copyto "/tmp/$file" ":s3:$R2_BUCKET/$R2_PREFIX/$file"
  rm -f "/tmp/$file"
  echo "[backup] pruning > ${KEEP_DAYS}d in r2:$R2_BUCKET/$R2_PREFIX/"
  rc delete ":s3:$R2_BUCKET/$R2_PREFIX" --min-age "${KEEP_DAYS}d" || true
  echo "[backup] done"
}

# BACKUP_ONESHOT=1 → 跑一次就退出(手動/測試用)
if [ "${BACKUP_ONESHOT:-0}" = "1" ]; then
  backup_once
  exit 0
fi

while true; do
  backup_once || echo "[backup] FAILED (will retry next cycle)"
  echo "[backup] sleep ${INTERVAL}s"
  sleep "$INTERVAL"
done
