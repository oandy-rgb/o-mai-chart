# 備份容器:postgres:17(pg_dump 與 server 版本相符)+ rclone(上傳 R2)。
# build context = deploy/docker(只需 backup.sh)。
FROM postgres:17

RUN apt-get update \
  && apt-get install -y --no-install-recommends rclone ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

ENTRYPOINT ["/usr/local/bin/backup.sh"]
