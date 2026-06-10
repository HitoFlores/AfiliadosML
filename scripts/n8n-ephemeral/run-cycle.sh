#!/usr/bin/env bash
set -euo pipefail

: "${N8N_ENCRYPTION_KEY:?Set N8N_ENCRYPTION_KEY}"
: "${N8N_CREDENTIALS_JSON_B64:?Set N8N_CREDENTIALS_JSON_B64 with exported n8n credentials}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
WORK_DIR="$ROOT_DIR/.tmp/n8n-ephemeral"
WORKFLOW_DIR="$WORK_DIR/workflows"
CREDENTIALS_FILE="$WORK_DIR/credentials.json"
LOG_DIR="$WORK_DIR/logs"
SUMMARY_FILE="$WORK_DIR/cycle-summary.md"

export N8N_USER_FOLDER="$WORK_DIR/user"
export DB_TYPE=sqlite
export DB_SQLITE_DATABASE="$WORK_DIR/database.sqlite"
export N8N_ENFORCE_SETTINGS_FILE_PERMISSIONS=false
export N8N_BLOCK_ENV_ACCESS_IN_NODE=false
export N8N_DIAGNOSTICS_ENABLED=false
export N8N_VERSION_NOTIFICATIONS_ENABLED=false
export N8N_TEMPLATES_ENABLED=false

mkdir -p "$WORK_DIR" "$N8N_USER_FOLDER" "$LOG_DIR"
{
  echo "AfiliadosML cycle summary"
  echo "Started: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "RUN_DAILY_SCHEDULER=${RUN_DAILY_SCHEDULER:-false}"
  echo "RUN_FRESHNESS=${RUN_FRESHNESS:-false}"
  echo "MAIN_MAX_RUNS=${MAIN_MAX_RUNS:-3}"
  echo ""
} > "$SUMMARY_FILE"
printf '%s' "$N8N_CREDENTIALS_JSON_B64" | base64 -d > "$CREDENTIALS_FILE"

npx --yes n8n@2.23.4 import:credentials --input="$CREDENTIALS_FILE"
npx --yes n8n@2.23.4 import:workflow --separate --input="$WORKFLOW_DIR"

echo "Imported workflows:"
npx --yes n8n@2.23.4 list:workflow

run_workflow() {
  local id="$1"
  local name="$2"
  local log_name
  log_name="$(echo "$name" | tr ' /:' '---' | tr -cd '[:alnum:]_.-')"
  local log_file="$LOG_DIR/${log_name}.log"

  echo "::group::n8n execute: $name"
  set +e
  npx --yes n8n@2.23.4 execute --id="$id" 2>&1 | tee "$log_file"
  local status="${PIPESTATUS[0]}"
  set -e
  echo "::endgroup::"

  if [[ "$status" -eq 0 ]]; then
    echo "- OK: $name" >> "$SUMMARY_FILE"
  else
    echo "- FAIL: $name" >> "$SUMMARY_FILE"
    tail -n 40 "$log_file" >> "$SUMMARY_FILE"
    send_cycle_summary || true
    exit "$status"
  fi
}

send_cycle_summary() {
  if [[ "${SEND_CYCLE_SUMMARY:-false}" != "true" ]]; then
    return 0
  fi
  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    return 0
  fi

  {
    echo ""
    echo "Finished: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  } >> "$SUMMARY_FILE"

  curl -sS -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
    --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
    --data-urlencode "text=$(cat "$SUMMARY_FILE")" >/dev/null
}

if [[ "${RUN_DAILY_SCHEDULER:-false}" == "true" ]]; then
  run_workflow "wG6XApFxO6SyCgIY" "Scheduler 7am"
fi

if [[ "${RUN_FRESHNESS:-false}" == "true" ]]; then
  run_workflow "freshnessAfML2026" "Freshness"
fi

# Telegram Poll may call the main workflow through Execute Workflow nodes.
run_workflow "wsMIARaCQQISWJtv" "Telegram Poll"

# The ephemeral runner cannot rely on n8n Execute Workflow activation state.
# Run main after polling; Route Row exits cleanly when no pending/ready row exists.
MAIN_MAX_RUNS="${MAIN_MAX_RUNS:-3}"
if ! [[ "$MAIN_MAX_RUNS" =~ ^[0-9]+$ ]] || [[ "$MAIN_MAX_RUNS" -lt 1 ]]; then
  MAIN_MAX_RUNS=3
fi
for ((i=1; i<=MAIN_MAX_RUNS; i++)); do
  run_workflow "iSQ59pcFepjqmBvC" "AfiliadosML main ${i}/${MAIN_MAX_RUNS}"
done

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  cat "$SUMMARY_FILE" >> "$GITHUB_STEP_SUMMARY"
fi

send_cycle_summary || true
