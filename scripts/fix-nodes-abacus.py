"""
fix-nodes-abacus.py
Restaura el prompt correcto (con tildes) del backup y configura los 3 nodos de Abacus.
Uso: python scripts/fix-nodes-abacus.py
"""
import json, urllib.request, sys, os

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMmVjOThiOS1hOTRhLTQ4Y2YtYjBkZC1jNTdmMDE0ZGVkMmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDZhYzA3MzctYjgyNS00NDliLTllNWUtYWUwNjVlYWEyNzU4IiwiaWF0IjoxNzgwNDQwOTQ5LCJleHAiOjE3ODA5Nzc2MDB9.bL-eFulsjvfTPkk3-4YTNK_2HeBNgTDJSqSw3IamuF8"
WF_ID   = "iSQ59pcFepjqmBvC"
BASE    = "http://localhost:5678/api/v1"
HDRS    = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}

BACKUP  = os.path.join(os.path.dirname(__file__), "..", "n8n-backup",
                       "iSQ59pcFepjqmBvC_AfiliadosML.json")

# IDs de los nodos
ID_BUILD  = "944acde7-4624-4ddd-96f5-a8e11898b46d"
ID_HTTP   = "a84059f1-5377-4585-9932-43aa54117b78"
ID_PARSE  = "bea74d95-9d2c-4ff5-a3c9-40e17b6d4851"
ID_FINAL  = "df9c2a23-3d8a-4abf-aad4-fd07971aeeaf"

# ── Helpers ──────────────────────────────────────────────────────────────────

def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def api_put(path, body):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(f"{BASE}{path}", data=data, method="PUT",
                                  headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

# ── Suffix del nodo Build Prompt (schema OpenAI para Abacus) ─────────────────

SUFFIX = r"""// OpenAI-compatible JSON Schema — Abacus RouteLLM (claude-sonnet-4-6)
const jsonSchema = {
  type: "object",
  properties: {
    editorial_score:     { type: "number" },
    score_justificacion: { type: "string" },
    sub_scores: {
      type: "array",
      items: {
        type: "object",
        properties: {
          dimension:    { type: "string" },
          score:        { type: "number" },
          justificacion:{ type: "string" }
        },
        required: ["dimension", "score", "justificacion"],
        additionalProperties: false
      }
    },
    veredicto_corto: { type: "string" },
    compralo_si:     { type: "array", items: { type: "string" } },
    saltatelo_si:    { type: "array", items: { type: "string" } },
    pros:            { type: "array", items: { type: "string" } },
    contras:         { type: "array", items: { type: "string" } },
    fuentes_citadas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo:  { type: "string" },
          autor: { type: "string" },
          aporte:{ type: "string" }
        },
        required: ["tipo", "autor", "aporte"],
        additionalProperties: false
      }
    },
    opiniones_destacadas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          aspecto:    { type: "string" },
          resumen:    { type: "string" },
          sentimiento:{ type: "string" }
        },
        required: ["aspecto", "resumen", "sentimiento"],
        additionalProperties: false
      }
    },
    seo_title:       { type: "string" },
    seo_description: { type: "string" },
    articulo_html:   { type: "string" }
  },
  required: [
    "editorial_score", "score_justificacion", "sub_scores", "veredicto_corto",
    "compralo_si", "saltatelo_si", "pros", "contras", "fuentes_citadas",
    "opiniones_destacadas", "seo_title", "seo_description", "articulo_html"
  ],
  additionalProperties: false
};

return [{
  json: {
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      response_format: {
        type: "json_schema",
        json_schema: { name: "review_output", strict: true, schema: jsonSchema }
      }
    })
  }
}];
"""

PARSE_CODE = r"""const raw = $input.first().json.choices[0].message.content;
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  throw new Error('Abacus parse error: ' + e.message + ' | Raw: ' + raw.substring(0, 200));
}
return [{ json: parsed }];
"""

# ── Main ─────────────────────────────────────────────────────────────────────

print("Leyendo backup...")
with open(BACKUP, encoding="utf-8-sig") as f:
    backup = json.load(f)

orig = next(n for n in backup["nodes"] if n["id"] == ID_BUILD)
orig_code = orig["parameters"]["jsCode"]

# Verificar tildes en backup
jam = orig_code.index("JAM")
char_a = orig_code[jam + 3]
print(f"Backup — char en JAMÁS[3]: {char_a!r}  (debe ser 'Á')")
if char_a != "Á":
    print("ERROR: backup también está corrupto. Abortando.")
    sys.exit(1)

# Construir nuevo código: prefix del backup (tildes correctas) + suffix Abacus
marker = "// Structured output"
prefix = orig_code[: orig_code.index(marker)]
new_build_code = prefix + SUFFIX

print("Obteniendo workflow actual de n8n...")
wf = api_get(f"/workflows/{WF_ID}")
print(f"Workflow: {wf['name']} | Nodos: {len(wf['nodes'])}")

# Parchear los 4 nodos
for node in wf["nodes"]:
    nid = node["id"]
    params = node.get("parameters", {})

    if nid == ID_BUILD:
        params["jsCode"] = new_build_code
        print("OK Nodo 1 (Build Prompt): prompt restaurado + schema Abacus")

    elif nid == ID_HTTP:
        params["url"] = "https://routellm.abacus.ai/v1/chat/completions"
        params["sendQuery"] = False
        params["queryParameters"] = {"parameters": []}
        params["sendHeaders"] = True
        params["headerParameters"] = {
            "parameters": [
                {"name": "Content-Type",  "value": "application/json"},
                {"name": "Authorization", "value": '={{ "Bearer " + $env.ABACUS_API_KEY }}'},
            ]
        }
        print("OK Nodo 2 (HTTP): URL + auth Abacus")

    elif nid == ID_PARSE:
        params["jsCode"] = PARSE_CODE
        print("OK Nodo 3 (Parse): choices[0].message.content")

    elif nid == ID_FINAL:
        code = params.get("jsCode", "")
        if "[`-?]" in code:
            params["jsCode"] = code.replace("[`-?]", r"[̀-ͯ]")
            print("OK Nodo 4 (Build Final JSON): regex de tildes restaurado")

print("\nEnviando a n8n...")
result = api_put(
    f"/workflows/{WF_ID}",
    {
        "name":        wf["name"],
        "nodes":       wf["nodes"],
        "connections": wf["connections"],
        "settings": {
            "executionOrder": wf["settings"]["executionOrder"],
            "errorWorkflow":  wf["settings"]["errorWorkflow"],
        },
        "staticData":  wf.get("staticData"),
    },
)

# Verificar resultado
n1 = next(n for n in result["nodes"] if n["id"] == ID_BUILD)
code_result = n1["parameters"]["jsCode"]
jam2 = code_result.index("JAM")
char2 = code_result[jam2 + 3]
tildes_ok = char2 == "Á"

n4 = next(n for n in result["nodes"] if n["id"] == ID_FINAL)
regex_ok = "[`-?]" not in n4["parameters"].get("jsCode", "")

n2 = next(n for n in result["nodes"] if n["id"] == ID_HTTP)
url_ok = n2["parameters"].get("url", "") == "https://routellm.abacus.ai/v1/chat/completions"

print("\n=== RESULTADO ===")
print(f"Tildes en prompt:  {'CORRECTAS OK' if tildes_ok  else f'CORRUPTAS ERROR (char={char2!r})'}")
print(f"Build Final regex: {'CORRECTO  OK' if regex_ok   else 'ROTO      ERROR'}")
print(f"URL Abacus:        {'CORRECTA  OK' if url_ok     else 'INCORRECTA ERROR'}")
print(f"Workflow: {result['name']} | Activo: {result['active']}")
