"""
push-to-n8n.py
Sube el backup local a n8n (usar después de levantar n8n).
Uso: python scripts/push-to-n8n.py
"""
import json, urllib.request, urllib.error, os, sys

BACKUP_PATH = os.path.join(os.path.dirname(__file__), "..", "n8n-backup", "iSQ59pcFepjqmBvC_AfiliadosML.json")
N8N_API     = "http://localhost:5678/api/v1"
N8N_TOKEN   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMmVjOThiOS1hOTRhLTQ4Y2YtYjBkZC1jNTdmMDE0ZGVkMmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDZhYzA3MzctYjgyNS00NDliLTllNWUtYWUwNjVlYWEyNzU4IiwiaWF0IjoxNzgwNDQwOTQ5LCJleHAiOjE3ODA5Nzc2MDB9.bL-eFulsjvfTPkk3-4YTNK_2HeBNgTDJSqSw3IamuF8"
WORKFLOW_ID = "iSQ59pcFepjqmBvC"

with open(BACKUP_PATH, "r", encoding="utf-8") as f:
    wf = json.load(f)

# GET current settings
try:
    req = urllib.request.Request(f"{N8N_API}/workflows/{WORKFLOW_ID}", headers={"X-N8N-API-KEY": N8N_TOKEN})
    with urllib.request.urlopen(req, timeout=10) as resp:
        current = json.loads(resp.read())
except Exception as e:
    print(f"ERROR: no se pudo conectar a n8n en {N8N_API}")
    print(f"  Asegurate de que n8n esté corriendo. ({e})")
    sys.exit(1)

settings = current.get("settings", {})
payload = {
    "name": wf["name"],
    "nodes": wf["nodes"],
    "connections": wf["connections"],
    "settings": {
        "executionOrder": settings.get("executionOrder", "v1"),
        "errorWorkflow": settings.get("errorWorkflow"),
    },
}

data = json.dumps(payload).encode("utf-8")
req2 = urllib.request.Request(
    f"{N8N_API}/workflows/{WORKFLOW_ID}",
    data=data,
    headers={"Content-Type": "application/json", "X-N8N-API-KEY": N8N_TOKEN},
    method="PUT",
)
try:
    with urllib.request.urlopen(req2, timeout=30) as resp:
        result = json.loads(resp.read())
        print(f"OK  Workflow actualizado: {result.get('updatedAt')}")
        print(f"    Nodos: {len(result['nodes'])}")
except urllib.error.HTTPError as e:
    print("ERROR", e.code, e.read()[:300])
