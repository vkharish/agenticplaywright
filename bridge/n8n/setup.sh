#!/usr/bin/env bash
# Imports and activates all bridge workflows into n8n via the public API v1.
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
import_workflow "$SCRIPT_DIR/generate-specs-workflow.json"
import_workflow "$SCRIPT_DIR/run-tests-workflow.json"
import_workflow "$SCRIPT_DIR/corporate-llm-workflow.json"

echo ""
echo "All done."
echo ""
echo "Webhook URLs (called automatically by Zephyr / CI):"
echo "  Snapshot    : $N8N_URL/webhook/bridge-snapshot"
echo "  Heal        : $N8N_URL/webhook/bridge-heal"
echo "  Generate LLM: $N8N_URL/webhook/bridge-generate-llm  (Option C — corporate LLM)"
echo ""
echo "Manual workflows (run from Windows browser at $N8N_URL):"
echo "  Generate Specs : Bridge — Generate Specs from MD"
echo "  Run Tests      : Bridge — Run Playwright Tests"
echo ""
echo "Option C — after import, open 'Bridge — Generate Spec via Corporate LLM' in n8n and:"
echo "  1. Click the 'Claude Sonnet' node → select your Anthropic credential"
echo "  2. Set BRIDGE_URL and BRIDGE_API_KEY in n8n environment variables"
echo "  3. Ensure app credentials (e.g. MY_APP_USERNAME) are in the bridge machine's ~/anthropic/.env"
echo ""
echo "HTML report (after running tests):"
echo "  http://localhost:9323   (if report server is running — see README)"
