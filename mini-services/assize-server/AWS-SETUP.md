# AWS setup — ASSIZE duel server (`eu-north-1`)

> **Live inventory (2026-10-14):** instance `i-03d0832cf4d0260c2` (`t3.micro`,
> eu-north-1a) · SG `sg-07d031c65437f3904` · volume `vol-005152c048b0eb407`
> (8 GB gp3, `/data`) · EIP `16.192.34.153` (`eipalloc-0c2c6cda8622c4aec`) ·
> key `assize-key` (`.pem` in operator `~/.aws/`, nowhere else).
> Project: FREE/ACTIVE, $100 credits to 2027-04-14.
>
> **TLS without a domain (2026-10-14):** origin is
> `https://16-192-34-153.sslip.io` — free wildcard DNS for the EIP, Let's Encrypt
> cert auto-issued + renewed by Caddy, WSS handshake verified live. No signup,
> no cost. If sslip.io ever fails, point any real domain/DuckDNS subdomain at the
> EIP and swap the one-line Caddyfile site block — zero code changes.


Target shape, same as Fly (see `DEPLOY.md`): **one machine + one volume**.
`rooms`/`queue` live in RAM, the ledger is a SQLite file — do not run two
instances. Region is `eu-north-1` (Stockholm) throughout; replace the region
flag if you ever move.

```
Internet --443--> Caddy (TLS, :80/:443) --127.0.0.1:3030--> assize-server (Docker, bun)
                                                              |
                                                     /data/assize.db (EBS gp3, WAL)
```

## 0. Pick the machine (costs, eu-north-1, on-demand)

| Choice | Spec | ~$/mo | Notes |
|---|---|---|---|
| `t3.micro` | 2 vCPU, 1 GB | **$0 first 12 mo** (free tier, 750 h/mo), then ~$9.50 | Recommended start on a new account |
| `t4g.nano` (ARM) | 2 vCPU, 0.5 GB | ~$4.40 | Cheapest long-term; 0.5 GB is enough (server idles < 100 MB) |
| `t4g.micro` (ARM) | 2 vCPU, 1 GB | ~$7 | Headroom pick after free tier ends |

Plus: 8 GB gp3 EBS ~$0.74/mo · Elastic IP $0 attached · first 100 GB transfer/mo free (game traffic is KBs). **Realistic total: $0–5/mo.**

> Measured capacity (Oct 2026 bench, real engine code): median tick cost
> **0.23 ms/room**, puzzle gen **3–12 ms** (event-loop block per pairing),
> snapshot **~0.6–2 KB** at 4 Hz. 2,000 DAU ≈ ~85 peak concurrent rooms ≈
> single-digit CPU. Do not over-provision.

## 1. One-time AWS groundwork (console or CLI)

```bash
R=eu-north-1
# key pair (keep the .pem safe; no password SSH ever)
aws ec2 create-key-pair --key-name assize-key --query KeyMaterial \
  --output text --region $R > assize-key.pem && chmod 400 assize-key.pem

# security group: 22 (your IP only), 80+443 (world, for Caddy/TLS + WSS)
SG=$(aws ec2 create-security-group --group-name assize-sg \
  --description "ASSIZE duel server" --region $R --query GroupId --output text)
MYIP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp \
  --port 22 --cidr $MYIP/32 --region $R
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp \
  --port 80 --cidr 0.0.0.0/0 --region $R
aws ec2 authorize-security-group-ingress --group-id $SG --protocol tcp \
  --port 443 --cidr 0.0.0.0/0 --region $R

# data volume (the ledger; survives instance replacement)
VOL=$(aws ec2 create-volume --availability-zone eu-north-1a --size 8 \
  --volume-type gp3 --tag-specifications 'ResourceType=volume,Tags=[{Key=Name,Value=assize-data}]' \
  --region $R --query VolumeId --output text)

# static address (survives stops/restarts; required for DNS + TLS)
aws ec2 allocate-address --domain vpc --region $R  # note the AllocationId + PublicIp
```

## 2. Launch the instance (Amazon Linux 2023, Docker via user-data)

```bash
AMI=$(aws ec2 describe-images --owners amazon --region $R \
  --filters "Name=name,Values=al2023-ami-*-x86_64" "Name=state,Values=available" \
  --query "sort_by(Images, &CreationDate)[-1].ImageId" --output text)
# (ARM t4g*: use al2023-ami-*-arm64 instead)
aws ec2 run-instances --image-id $AMI --instance-type t3.micro --key-name assize-key \
  --security-group-ids $SG --placement AvailabilityZone=eu-north-1a \
  --block-device-mappings DeviceName=/dev/xvda,Ebs={VolumeSize=8,VolumeType=gp3} \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=assize-duel}]' \
  --user-data file://mini-services/assize-server/aws-user-data.sh \
  --region $R  # note the InstanceId
aws ec2 attach-volume --volume-id $VOL --instance-id <InstanceId> \
  --device /dev/sdf --region $R
aws ec2 associate-address --instance-id <InstanceId> \
  --allocation-id <AllocationId> --region $R
```

`aws-user-data.sh` (create next to this file; keeps the box reproducible):

```bash
#!/bin/bash
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user
mkdir -p /data
echo "UUID=$(blkid -s UUID -o value /dev/sdf) /data xfs defaults,nofail 0 2" >> /etc/fstab
mkfs.xfs -f /dev/sdf 2>/dev/null || true
mount -a
dnf install -y caddy
systemctl enable --now caddy
```
> **2026-10-14 correction:** Caddy is NOT in AL2023's default repos — `dnf install
> caddy` fails. Install the pinned static binary instead (done on the live box):
> ```bash
> TAG=v2.11.7  # re-check latest at https://github.com/caddyserver/caddy/releases
> curl -sL "https://github.com/caddyserver/caddy/releases/download/${TAG}/caddy_${TAG#v}_linux_amd64.tar.gz" -o /tmp/caddy.tgz
> sudo tar -xzf /tmp/caddy.tgz -C /usr/bin caddy
> # + caddy user, /etc/caddy/Caddyfile, systemd unit (see live box /etc/systemd/system/caddy.service)
> ```
> Ship `.sh` files to the box with `scp` and strip CRLF there
> (`sed -i "s/\r$//"`): piping Windows text through ssh re-adds `\r` and breaks bash.


## 3. On the box: Caddy + the server

```bash
ssh -i assize-key.pem ec2-user@<ElasticIp>
git clone <your-repo-url> sudoku && cd sudoku
# Caddyfile (TLS auto, WSS upgrade forwarded untouched):
sudo tee /etc/caddy/Caddyfile >/dev/null <<'EOF'
duel.example.com {
    reverse_proxy 127.0.0.1:3030
}
EOF
sudo systemctl reload caddy
# first deploy:
docker build -f mini-services/assize-server/Dockerfile -t assize-server .
docker run -d --name assize --restart unless-stopped -p 127.0.0.1:3030:3030 \
  -v /data:/data -e ASSIZE_DB=/data/assize.db assize-server
curl -s http://127.0.0.1:3030/api/health  # {"ok":true,"rooms":0,"queue":0,...}
```

Point `duel.example.com` at the Elastic IP, wait ~1 min for TLS, then
`curl https://duel.example.com/api/health`. Bake the origin into clients
(`EXPO_PUBLIC_ASSIZE_SERVER` must exist **before** `eas build`; later flips go
out via OTA, no review).

## 4. Operate

- **Redeploy** (downtime ~10 s, live duels drop — announce or ship off-peak):
  `git pull && docker build … && docker stop assize && docker rm assize && docker run …` (same flags as §3).
- **Back up the ledger**: weekly EBS snapshot
  (`aws ec2 create-snapshot --volume-id $VOL`), plus copy `/data/assize.db`
  off-box after quiet hours. Snapshot before every redeploy.
- **Watch it**: CloudWatch status-check alarm on the instance (free-tier
  eligible) + any free uptime monitor hitting `GET /api/health`
  (`{"ok":true,"rooms":N,"queue":N}`) and alerting on `rooms` growth without
  bound (leaked ended rooms — see bug P1-1 below; monitor until fixed).
- **Logs**: `docker logs assize | grep "tick error\|matchmaking error"`.
- **Laws** (from `DEPLOY.md`, still binding): one instance only · https only
  (mobile refuses cleartext) · volume is the save file.

## 5. Known server issues to fix before trusting production

Re-audited Oct 2026 (guard lines + benchmarks re-run; findings reconfirmed):

- **P0 functional (not perf, but launch-blocking)**: natural duel ends never
  settle (`index.ts:101` early-returns on `phase==='ended'`, called only after
  it flips at `:152` — no `end` emit, no Elo, no duel row); seat-1 verdicts
  inverted (`:122` relativizes, client maps again); duel hijack via
  `join_duel`/`reconnect` default seats (`:284`, `:346`); self-play Ink farm
  (pairing checks `socketId` only, `:177`, no `p0===p1` guard in settle law).
- **P1 perf, measured**: puzzle gen blocks the loop **3–12 ms per pairing**
  (bursts serialize — pre-generate a pool); `/api/daily` regenerates per
  request (~4 ms, uncached — memoize per date key, trivial DoS amplifier);
  4 Hz full snapshots (~0.6–2 KB × 2 seats × rooms) + dead `state_delta`
  emits (no subscriber — delete); telemetry write per fast-place with an
  **unbounded, client-writable** table (rate-limit + prune); matchmaking
  O(n²)/500 ms (fine to ~1–2k queued); no rate limits anywhere.
- **P1 slow leak (corrected measurement)**: leaked ended rooms cost only
  **~3 KB RAM each** (~15 MB/day at 3k duels/day — weeks to matter, not days;
  engine caps `events`, no in-duel growth). Fix with the settle rewrite; until
  then watch `rooms` in `/api/health`.
- **Tick CPU is a non-issue**: 0.23 ms/room/tick → 85 peak rooms ≈ 8% of the
  250 ms budget. `place()` ≈ 0.3 µs. Never scale for CPU at this size.
