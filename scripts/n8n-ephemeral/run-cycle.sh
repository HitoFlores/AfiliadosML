#!/usr/bin/env bash
set -euo pipefail

: "${N8N_ENCRYPTION_KEY:?Set N8N_ENCRYPTION_KEY}"
: "${N8N_CREDENTIALS_JSON_B64:?Set N8N_CREDENTIALS_JSON_B64 with exported n8n credentials}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK_DIR="$ROOT_DIR/.tmp/n8n-ephemeral"
WORKFLOW_DIR="$WORK_DIR/workflows"
CREDENTIALS_FILE="$WORK_DIR/credentials.json"

export N8N_USER_FOLDER="$WORK_DIR/user"
export DB_TYPE=sqlite
export DB_SQLITE_DATABASE="$WORK_DIR/database.sqlite"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_TEMPLATES_ENABLED=false

mkdir -p "$WORK_DIR" "$N8N_USER_FOLDER"
printf '%s' "$N8N_CREDENTIALS_JSON_B64" | base64 -d > "$CREDENTIALS_FILE"

npx --yes n8n@2.23.4 import:credentials --input="$CREDENTIALS_FILE"
npx --yes n8n@2.23.4 import:workflow --separate --input="$WORKFLOW_DIR"

echo "Imported workflows:"
npx --yes n8n@2.23.4 list:workflow

run_workflow() {
  local id="$1"
  local name="$2"
  echo "::group::n8n execute: $name"
  npx --yes n8n@2.23.4 execute --id="$id"
  echo "::endgroup::"
}

if [[ "${RUN_DAILY_SCHEDULER:-false}" == "true" ]]; then
  run_workflow "wG6XApFxO6SyCgIY" "Scheduler 7am"
fi

# Telegram Poll may call the main workflow through Execute Workflow nodes.
run_workflow "wsMIARaCQQISWJtv" "Telegram Poll"

# The ephemeral runner cannot rely on n8n Execute Workflow activation state.
# Run main after polling; Route Row exits cleanly when no pending/ready row exists.
run_workflow "iSQ59pcFepjqmBvC" "AfiliadosML main"
