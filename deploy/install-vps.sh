#!/usr/bin/env bash
set -Eeuo pipefail
(( EUID == 0 )) || { echo 'Run with sudo' >&2; exit 1; }
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if ! id deploy >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash deploy
fi
install -d -m 0700 -o deploy -g deploy /home/deploy/.ssh
if [[ ! -f /home/deploy/.ssh/authorized_keys ]]; then
  install -m 0600 -o deploy -g deploy /dev/null /home/deploy/.ssh/authorized_keys
fi
install -m 0755 -o root -g root "$SCRIPT_DIR/overleaf-deploy" /usr/local/sbin/overleaf-deploy
cat > /etc/sudoers.d/overleaf-deploy <<'EOF'
deploy ALL=(root) NOPASSWD: /usr/local/sbin/overleaf-deploy
EOF
chmod 0440 /etc/sudoers.d/overleaf-deploy
visudo -cf /etc/sudoers.d/overleaf-deploy
printf 'Created deploy user and restricted sudo permission. Add GitHub Actions PUBLIC key to /home/deploy/.ssh/authorized_keys.\n'
