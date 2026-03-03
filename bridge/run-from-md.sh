#!/usr/bin/env bash
# Reads a test-cases .md file, calls the bridge snapshot endpoint for each
# test case, and saves structured JSON results to snapshots/.
#
# Usage:
#   bash run-from-md.sh [path/to/test-cases.md]

set -euo pipefail

MD_FILE="${1:-$(dirname "$0")/test-cases/the-internet.md}"
N8N_URL="${N8N_URL:-http://localhost:5678}"
BRIDGE_URL="${BRIDGE_URL:-http://localhost:3000}"
OUT_DIR="$(dirname "$0")/snapshots"
mkdir -p "$OUT_DIR"

# Prefer n8n webhook; fall back to bridge directly
if curl -sf "$N8N_URL/healthz" > /dev/null 2>&1; then
  ENDPOINT="$N8N_URL/webhook/bridge-snapshot"
  echo "→ Routing through n8n ($ENDPOINT)"
else
  ENDPOINT="$BRIDGE_URL/snapshot"
  echo "→ n8n not reachable, calling bridge directly ($ENDPOINT)"
fi

# ── Parse markdown into parallel arrays (name / url / description) ───────────
# Tracks the current ## heading and description as we scan line by line.
NAMES=()
URLS=()
DESCS=()

current_name=""
current_url=""
current_desc=""

flush_section() {
  if [[ -n "$current_url" ]]; then
    NAMES+=("$current_name")
    URLS+=("$current_url")
    DESCS+=("$current_desc")
    current_url=""
    current_desc=""
  fi
}

while IFS= read -r line; do
  if [[ "$line" =~ ^##[[:space:]]+(.*) ]]; then
    flush_section
    current_name="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ ^url:[[:space:]]+(.*) ]]; then
    current_url="${BASH_REMATCH[1]}"
  elif [[ "$line" =~ ^description:[[:space:]]+(.*) ]]; then
    current_desc="${BASH_REMATCH[1]}"
  fi
done < "$MD_FILE"
flush_section  # capture the last section

if [[ ${#URLS[@]} -eq 0 ]]; then
  echo "No 'url: ...' lines found in $MD_FILE"
  exit 1
fi

echo "Found ${#URLS[@]} test case(s) in $MD_FILE"
echo ""

PASS=0
FAIL=0

for i in "${!URLS[@]}"; do
  name="${NAMES[$i]}"
  url="${URLS[$i]}"
  desc="${DESCS[$i]}"

  # Filename based on test case name (slug), not URL
  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/_/g' | sed 's/__*/_/g; s/^_//; s/_$//')
  out="$OUT_DIR/${slug}.json"

  echo "  [$(( i + 1 ))/${#URLS[@]}] $name"
  echo "         $desc"
  printf  "         %-50s " "$url"

  payload=$(python3 -c "
import json
print(json.dumps({'url': '$url'}))
")

  response=$(curl -sf -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -H "x-api-key: ${BRIDGE_API_KEY:-dev-key}" \
    -d "$payload" 2>/dev/null || echo '{"success":false,"error":"curl failed"}')

  success=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('success', False))" 2>/dev/null || echo "False")

  if [[ "$success" == "True" ]]; then
    # Inject test case metadata into the saved JSON
    echo "$response" | python3 -c "
import json, sys
d = json.load(sys.stdin)
d['testCase'] = {'name': '$name', 'description': '$desc', 'sourceFile': '$MD_FILE'}
print(json.dumps(d, indent=2))
" > "$out"

    locator_count=$(python3 -c "import json; print(len(json.load(open('$out')).get('suggestedLocators', [])))")
    echo "✓  ($locator_count locators) → snapshots/$(basename "$out")"
    ((PASS++))
  else
    error=$(echo "$response" | python3 -c "import json,sys; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null || echo "unknown")
    echo "✗  $error"
    ((FAIL++))
  fi

  echo ""
done

echo "Done: $PASS passed, $FAIL failed."
echo "Results saved to: $OUT_DIR/"
