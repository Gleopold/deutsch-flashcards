#!/usr/bin/env bash
# Deploy the flashcards to production at https://app.virtup.eu/flashcards/
# Served by connect2's nginx (location /flashcards/ in
# /opt/connect2/nginx/api.virtup.eu.conf), which proxies to flashcards-app
# over the connect2_default network.
# Usage: bash push-flashcards.sh [server-ip]
#        SSH_KEY=~/.ssh/mykey bash push-flashcards.sh
set -euo pipefail

SERVER="root@${1:-5.250.189.248}"
REMOTE_DIR="/opt/flashcards"
KEY="${SSH_KEY:-$HOME/.ssh/id_rsa}"
SSH_OPTS="-i $KEY -o StrictHostKeyChecking=no"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "[1/2] Syncing files → $SERVER:$REMOTE_DIR"
rsync -az --delete -e "ssh $SSH_OPTS" \
  --exclude='.git/' --exclude='mobile/' --exclude='tools/' --exclude='__pycache__/' --exclude='data/' \
  "$SCRIPT_DIR/" "$SERVER:$REMOTE_DIR/"

echo "[2/2] Building and starting container..."
ssh $SSH_OPTS "$SERVER" 'cd /opt/flashcards && docker compose -p flashcards up -d --build \
  && docker exec connect2-nginx-1 nginx -t && docker exec connect2-nginx-1 nginx -s reload'

echo ""
echo "Done! https://app.virtup.eu/flashcards/"
