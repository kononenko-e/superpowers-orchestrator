#!/usr/bin/env sh
# Bootstrap script for superpowers-orchestrator
# One-command install:
#   curl -fsSL https://raw.githubusercontent.com/kononenko-e/superpowers-orchestrator/main/bootstrap.sh | sh
# Or:
#   git clone https://github.com/kononenko-e/superpowers-orchestrator.git ~/.superpowers-orchestrator && \
#   cd ~/.superpowers-orchestrator && node install.js

set -e

INSTALL_DIR="$HOME/.superpowers-orchestrator"
REPO_URL="https://github.com/kononenko-e/superpowers-orchestrator.git"

# Check Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required but not found. Install Node.js >= 18 first."
  exit 1
fi

MAJOR=$(node -e "console.log(process.version.slice(1).split('.')[0])" 2>/dev/null || echo 0)
if [ "$MAJOR" -lt 18 ]; then
  echo "Error: Node.js >= 18 required. Found: $(node --version)"
  exit 1
fi

# Check git
if ! command -v git >/dev/null 2>&1; then
  echo "Error: git is required but not found."
  exit 1
fi

# Clone if not already present
if [ ! -d "$INSTALL_DIR/.git" ]; then
  if [ -d "$INSTALL_DIR" ]; then
    echo "Install directory exists but is not a git repo. Removing and re-cloning..."
    rm -rf "$INSTALL_DIR"
  fi
  echo "Cloning superpowers-orchestrator..."
  git clone "$REPO_URL" "$INSTALL_DIR"
else
  echo "Repository already exists at $INSTALL_DIR — pulling latest..."
  git -C "$INSTALL_DIR" pull || true
fi

# Run installer
echo ""
echo "Starting installer..."
cd "$INSTALL_DIR"
node install.js
