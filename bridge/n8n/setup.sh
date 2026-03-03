#!/usr/bin/env bash
# Imports and activates both bridge workflows into n8n via the public API v1.
#
# Requires N8N_API_KEY — create one in n8n UI:
#   Settings (bottom-left) → API → Create an API key → copy it
#
# Usage:
#   N8N_API_KEY=<key> bash n8n/setup.sh

set -euo pipefail

N8N_URL="${N8N_URL:-http://localhost:5678}"
N8N_API_KEY="${N8N_API_KEY:?Please set N8N_API_KEY. Create one in n8n UI: Settings → API → Create an API key}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Waiting for n8n at $N8N_URL …"
until curl -sf "$N8N_URL/healthz" > /dev/null 2>&1; do printf '.'; sleep 2; done
echo " ready."

echo "→ Verifying API key …"
curl -sf -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_URL/api/v1/workflows" > /dev/null
echo "  API key valid."

import_workflow() {
  local file="$1"
  local name
  name=$(python3 -c "import json; print(json.load(open('$file'))['name'])")
  echo "→ Importing: $name"

  local resp id
  resp=$(curl -sf \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -H "Content-Type: application/json" \
    -X POST "$N8N_URL/api/v1/workflows" \
    -d @"$file")
  id=$(python3 -c "import json,sys; print(json.load(sys.stdin)['id'])" <<< "$resp")

  curl -sf \
    -H "X-N8N-API-KEY: $N8N_API_KEY" \
    -X POST "$N8N_URL/api/v1/workflows/$id/activate" > /dev/null

  echo "  Imported id=$id and activated."
}

import_workflow "$SCRIPT_DIR/snapshot-workflow.json"
import_workflow "$SCRIPT_DIR/heal-workflow.json"

echo ""
echo "All done. Webhook URLs:"
echo "  Snapshot : $N8N_URL/webhook/bridge-snapshot"
echo "  Heal     : $N8N_URL/webhook/bridge-heal"
