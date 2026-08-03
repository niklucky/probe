#!/usr/bin/env bash
set -Eeuo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "provision.sh must run as root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get install -y ca-certificates curl gnupg ufw fail2ban unattended-upgrades

if ! command -v docker >/dev/null 2>&1; then
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
  chmod a+r /etc/apt/keyrings/docker.asc
  architecture=$(dpkg --print-architecture)
  release=$(. /etc/os-release && echo "$VERSION_CODENAME")
  echo "deb [arch=${architecture} signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${release} stable" > /etc/apt/sources.list.d/docker.list
  apt-get update
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

systemctl enable --now docker fail2ban unattended-upgrades

if ! id probe >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash probe
fi
usermod -aG docker probe
install -d -m 0700 -o probe -g probe /home/probe/.ssh
if [[ -n ${DEPLOY_PUBLIC_KEY:-} ]]; then
  touch /home/probe/.ssh/authorized_keys
  if ! grep -Fqx "$DEPLOY_PUBLIC_KEY" /home/probe/.ssh/authorized_keys; then
    echo "$DEPLOY_PUBLIC_KEY" >> /home/probe/.ssh/authorized_keys
  fi
  chown probe:probe /home/probe/.ssh/authorized_keys
  chmod 0600 /home/probe/.ssh/authorized_keys
fi

install -d -m 0750 -o probe -g probe /opt/probe /opt/probe/deploy /opt/probe/backups
install -d -m 0770 -o probe -g probe /var/lib/probe/runner

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 0600 /swapfile
  mkswap /swapfile
fi
swapon --show=NAME --noheadings | grep -Fxq /swapfile || swapon /swapfile
grep -Fqx '/swapfile none swap sw 0 0' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

cat > /etc/docker/daemon.json <<'JSON'
{
  "log-driver": "local",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "live-restore": true
}
JSON
systemctl restart docker

ufw default deny incoming
ufw default allow outgoing
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

if ! docker network inspect probe-runner-egress >/dev/null 2>&1; then
  docker network create --driver bridge --subnet 172.30.0.0/24 probe-runner-egress
fi

# Execution containers may reach public test targets, but never the VPS, private
# networks, link-local services, multicast ranges, or cloud metadata endpoints.
cat > /usr/local/sbin/probe-runner-firewall <<'FIREWALL'
#!/usr/bin/env bash
set -Eeuo pipefail
iptables -N PROBE-RUNNER-EGRESS 2>/dev/null || true
iptables -F PROBE-RUNNER-EGRESS
iptables -C DOCKER-USER -s 172.30.0.0/24 -j PROBE-RUNNER-EGRESS 2>/dev/null || \
  iptables -I DOCKER-USER 1 -s 172.30.0.0/24 -j PROBE-RUNNER-EGRESS
iptables -A PROBE-RUNNER-EGRESS -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN
for destination in 0.0.0.0/8 10.0.0.0/8 100.64.0.0/10 127.0.0.0/8 169.254.0.0/16 172.16.0.0/12 192.0.0.0/24 192.168.0.0/16 224.0.0.0/4 240.0.0.0/4; do
  iptables -A PROBE-RUNNER-EGRESS -d "$destination" -j REJECT
done
iptables -A PROBE-RUNNER-EGRESS -j RETURN
FIREWALL
chmod 0755 /usr/local/sbin/probe-runner-firewall

cat > /etc/systemd/system/probe-runner-firewall.service <<'UNIT'
[Unit]
Description=Probe execution-container egress policy
Requires=docker.service
After=docker.service
PartOf=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/probe-runner-firewall
RemainAfterExit=yes

[Install]
WantedBy=docker.service
UNIT
systemctl daemon-reload
systemctl enable --now probe-runner-firewall.service

cat > /etc/cron.d/probe-backup <<'CRON'
17 2 * * * probe /opt/probe/deploy/backup.sh >> /opt/probe/backups/backup.log 2>&1
CRON
chmod 0644 /etc/cron.d/probe-backup

echo "VPS provisioning complete"
