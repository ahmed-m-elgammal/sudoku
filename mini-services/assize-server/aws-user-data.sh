#!/bin/bash
# ASSIZE duel server — EC2 user-data (Amazon Linux 2023).
# Referenced by AWS-SETUP.md §2. Reproducible base box: Docker + Caddy + /data.
# The ledger volume (EBS, attached as /dev/sdf) is formatted once and mounted
# at /data; the fstab entry uses nofail so a missing volume never bricks boot.
set -euo pipefail

dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

mkdir -p /data
if ! blkid /dev/sdf >/dev/null 2>&1; then
  mkfs.xfs -f /dev/sdf
fi
UUID=$(blkid -s UUID -o value /dev/sdf)
grep -q "$UUID" /etc/fstab 2>/dev/null || echo "UUID=$UUID /data xfs defaults,nofail 0 2" >> /etc/fstab
mount -a

dnf install -y caddy
systemctl enable --now caddy
