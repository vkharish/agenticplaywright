#!/usr/bin/env bash
# setup-linux.sh — one-shot setup for the agentic Playwright framework on Linux
#
# Run once on a fresh Linux box:
#   bash setup-linux.sh
#
# What it does:
#   1. Installs nvm + Node.js 20 (if not already installed)
#   2. Installs pm2 globally
#   3. Clones the repo (or pulls latest if already cloned)
#   4. Installs all dependencies
#   5. Builds the bridge
#   6. Prompts for secrets and writes .env files
#   7. Starts bridge with pm2
#   8. (Optional) starts n8n with pm2

set -euo pipefail

REPO_URL="git@github.com:vkharish/agenticplaywright.git"
INSTALL_DIR="$HOME/anthropic"
NODE_VERSION="20"

# ── colours ───────────────────────────────────────────────────────────────────
green() { echo -e "\033[0;32m$*\033[0m"; }
yellow() { echo -e "\033[0;33m$*\033[0m"; }
red() { echo -e "\033[0;31m$*\033[0m"; }
step() { echo; green "▶ $*"; }

# ── 1. nvm + Node.js ──────────────────────────────────────────────────────────
step "Checking Node.js..."

if ! command -v node &>/dev/null || [[ "$(node -e 'process.stdout.write(process.version.slice(1).split(\".\")[0])')" -lt "$NODE_VERSION" ]]; then
  yellow "Installing nvm + Node.js $NODE_VERSION..."
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  fi
  export NVM_DIR="$HOME/.nvm"
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm install "$NODE_VERSION"
  nvm use "$NODE_VERSION"
  nvm alias default "$NODE_VERSION"
  # Persist nvm in shell profile
  for profile in ~/.bashrc ~/.zshrc ~/.profile; do
    if [ -f "$profile" ] && ! grep -q 'NVM_DIR' "$profile"; then
      cat >> "$profile" << 'NVMEOF'

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
NVMEOF
    fi
  done
else
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"
  green "Node.js $(node --version) already installed."
fi

# ── 2. pm2 ───────────────────────────────────────────────────────────────────
step "Checking pm2..."
if ! command -v pm2 &>/dev/null; then
  yellow "Installing pm2..."
  npm install -g pm2
else
  green "pm2 $(pm2 --version) already installed."
fi

# ── 3. Clone / pull repo ─────────────────────────────────────────────────────
step "Setting up repository at $INSTALL_DIR..."
if [ -d "$INSTALL_DIR/.git" ]; then
  yellow "Repo already cloned — pulling latest..."
  git -C "$INSTALL_DIR" pull
else
  git clone "$REPO_URL" "$INSTALL_DIR"
fi

# ── 4. Install dependencies ───────────────────────────────────────────────────
step "Installing root dependencies..."
npm --prefix "$INSTALL_DIR" install

step "Installing Playwright browser (chromium)..."
npx --prefix "$INSTALL_DIR" playwright install chromium --with-deps

step "Installing bridge dependencies..."
npm --prefix "$INSTALL_DIR/bridge" install

step "Building bridge..."
npm --prefix "$INSTALL_DIR/bridge" run build

# ── 5. Write .env files ───────────────────────────────────────────────────────
step "Configuring environment..."

# Root .env
ROOT_ENV="$INSTALL_DIR/.env"
if [ ! -f "$ROOT_ENV" ]; then
  cp "$INSTALL_DIR/.env.example" "$ROOT_ENV"
  echo
  yellow "Root .env created. Fill in your app credentials:"
  yellow "  $ROOT_ENV"
fi

# Bridge .env
BRIDGE_ENV="$INSTALL_DIR/bridge/.env"
if [ ! -f "$BRIDGE_ENV" ]; then
  echo
  yellow "Bridge needs an Anthropic API key for spec generation."
  read -rp "  Enter your ANTHROPIC_API_KEY (sk-ant-...): " ANTHROPIC_KEY
  echo
  read -rp "  Enter BRIDGE_API_KEY (press Enter to use 'dev-key'): " BRIDGE_KEY
  BRIDGE_KEY="${BRIDGE_KEY:-dev-key}"

  cat > "$BRIDGE_ENV" << EOF
BRIDGE_API_KEY=$BRIDGE_KEY
ANTHROPIC_API_KEY=$ANTHROPIC_KEY
PORT=3000
EOF
  green "bridge/.env written."
else
  green "bridge/.env already exists — skipping."
fi

# ── 6. Start bridge with pm2 ──────────────────────────────────────────────────
step "Starting bridge with pm2..."
pm2 describe bridge &>/dev/null && pm2 restart bridge || \
  pm2 start npm --name bridge -- start --prefix "$INSTALL_DIR/bridge"

sleep 2
if curl -sf http://localhost:3000/health &>/dev/null; then
  green "Bridge is up at http://localhost:3000"
else
  red "Bridge health check failed — run: pm2 logs bridge"
fi

# ── 7. n8n (optional) ─────────────────────────────────────────────────────────
echo
read -rp "Start n8n too? (y/N): " START_N8N
if [[ "$START_N8N" =~ ^[Yy]$ ]]; then
  pm2 describe n8n &>/dev/null && pm2 restart n8n || \
    pm2 start npx --name n8n -- n8n

  sleep 3
  if curl -sf http://localhost:5678/healthz &>/dev/null; then
    green "n8n is up at http://localhost:5678"
  else
    yellow "n8n may still be starting — check: pm2 logs n8n"
  fi
fi

# ── 8. Start report server ────────────────────────────────────────────────────
echo
read -rp "Start Playwright report server on port 9323? (y/N): " START_REPORT
if [[ "$START_REPORT" =~ ^[Yy]$ ]]; then
  pm2 describe report &>/dev/null && pm2 restart report || \
    pm2 start "npx serve playwright-report -l 9323" --name report \
      --cwd "$INSTALL_DIR"
  green "Report server at http://localhost:9323"
fi

# ── 9. Save pm2 on reboot ─────────────────────────────────────────────────────
pm2 save
echo
green "────────────────────────────────────────────"
green " Setup complete!"
green "────────────────────────────────────────────"
echo
echo "  Generate specs:  node $INSTALL_DIR/bridge/run-from-md.js $INSTALL_DIR/bridge/test-cases/the-internet.md"
echo "  Run tests:       cd $INSTALL_DIR && npx playwright test --project=chromium"
echo "  View logs:       pm2 logs bridge"
echo "  Restart bridge:  pm2 restart bridge"
echo
yellow "SSH tunnel from Windows:"
echo "  ssh -L 3000:localhost:3000 -L 5678:localhost:5678 -L 9323:localhost:9323 user@$(hostname)"
echo
yellow "To make pm2 survive reboots, run once:"
echo "  pm2 startup"
echo "  (follow the printed command)"
