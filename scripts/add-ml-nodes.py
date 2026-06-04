"""
add-ml-nodes.py
Agrega al pipeline AfiliadosML:
  1. Get ML Questions  — preguntas reales de compradores via ML API
  2. Get Similar Products — búsqueda por categoría + rango de precio
Inserta ambos entre Transcripciones y Build Gemini Prompt.
Actualiza el Build Prompt para usar los datos reales.
"""
import json, urllib.request, uuid, os

API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMmVjOThiOS1hOTRhLTQ4Y2YtYjBkZC1jNTdmMDE0ZGVkMmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDZhYzA3MzctYjgyNS00NDliLTllNWUtYWUwNjVlYWEyNzU4IiwiaWF0IjoxNzgwNDQwOTQ5LCJleHAiOjE3ODA5Nzc2MDB9.bL-eFulsjvfTPkk3-4YTNK_2HeBNgTDJSqSw3IamuF8"
WF_ID  = "iSQ59pcFepjqmBvC"
BASE   = "http://localhost:5678/api/v1"
HDRS   = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
BACKUP = os.path.join(os.path.dirname(__file__), "..", "n8n-backup",
                      "iSQ59pcFepjqmBvC_AfiliadosML.json")

ID_BUILD        = "944acde7-4624-4ddd-96f5-a8e11898b46d"
NAME_BUILD      = "Build Gemini Prompt"
NAME_TRANS      = "Transcripciones"
ID_ML_Q         = str(uuid.uuid4())
ID_ML_SIM       = str(uuid.uuid4())
NAME_ML_Q       = "Get ML Questions"
NAME_ML_SIM     = "Get Similar Products"

def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def api_put(path, body):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(f"{BASE}{path}", data=data, method="PUT", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

# ── Nuevos nodos ──────────────────────────────────────────────────────────────

NODE_ML_Q = {
    "id":   ID_ML_Q,
    "name": NAME_ML_Q,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.4,
    "position": [1168, -528],
    "continueOnFail": True,   # sin Q&A = no rompe
    "parameters": {
        "url": "=https://api.mercadolibre.com/questions/search?item={{ $('Get Data ML').first().json.id }}&status=answered&sort_fields=date_created&sort_types=DESC&limit=12",
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "Authorization",
                 "value": "=Bearer {{ $('Refresh Token').item.json.access_token }}"}
            ]
        },
        "options": {}
    }
}

NODE_ML_SIM = {
    "id":   ID_ML_SIM,
    "name": NAME_ML_SIM,
    "type": "n8n-nodes-base.httpRequest",
    "typeVersion": 4.4,
    "position": [1392, -528],
    "continueOnFail": True,   # sin similares = no rompe
    "parameters": {
        # Busca por categoría del producto + rango ±25% del precio
        "url": (
            "=https://api.mercadolibre.com/sites/MLM/search"
            "?q={{ encodeURIComponent((($('Get Data ML').first().json.attributes.find(a => a.name === 'Marca') || {}).value_name || '') + ' ' + ($('Get Data ML').first().json.name || '').split(' ').slice(0,2).join(' ')) }}"
            "&price={{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 0.75 || 0) }}"
            "-{{ Math.round((($('Get Item Sellers').first().json.results || [])[0] || {}).price * 1.35 || 0) }}"
            "&sort=relevance&limit=6"
        ),
        "sendHeaders": True,
        "headerParameters": {
            "parameters": [
                {"name": "Authorization",
                 "value": "=Bearer {{ $('Refresh Token').item.json.access_token }}"}
            ]
        },
        "options": {}
    }
}

# ── Código adicional para Build Prompt (prepend antes del prompt template) ───

BUILD_PREPEND = r"""
// ── Datos de nodos v3 (con fallback seguro si el nodo falló) ──────────────
let preguntasML = '';
try {
  const qs = ($('Get ML Questions').first().json.questions || [])
    .filter(q => q.answer && q.answer.text && q.text && q.text.length > 10)
    .slice(0, 8);
  if (qs.length > 0) {
    preguntasML = qs.map(q => `P: ${q.text.trim()}\nR: ${q.answer.text.trim()}`).join('\n\n');
  }
} catch(e) { preguntasML = ''; }

let similaresMl = '';
try {
  const currentId = $('Get Data ML').first().json.id;
  const results = ($('Get Similar Products').first().json.results || [])
    .filter(it => it.id !== currentId && it.title && it.price)
    .slice(0, 4);
  if (results.length > 0) {
    similaresMl = results.map(it =>
      `- ${it.title} | $${(it.price||0).toLocaleString('es-MX')} MXN`
    ).join('\n');
  }
} catch(e) { similaresMl = ''; }

"""

# Sección del prompt que reemplaza las instrucciones de FAQ/alternativas
# (para inyectar los datos reales)
OLD_FAQ_INSTRUCTION = "PREGUNTAS FRECUENTES (FAQ): basándote en las opiniones"
NEW_FAQ_INSTRUCTION = """PREGUNTAS FRECUENTES (FAQ): tienes disponibles las siguientes preguntas reales de compradores en Mercado Libre y sus respuestas oficiales:
${preguntasML || '(no hay preguntas disponibles para este producto)'}

Basándote en esas preguntas reales Y en las opiniones de compradores y videos"""

OLD_ALT_INSTRUCTION = "ALTERNATIVAS EDITORIALES: en el campo"
NEW_ALT_INSTRUCTION = """ALTERNATIVAS EDITORIALES: los siguientes productos aparecen en Mercado Libre en un rango de precio similar:
${similaresMl || '(sin datos de competencia disponibles)'}

Usando esa referencia de mercado, en el campo"""

# ── Main ─────────────────────────────────────────────────────────────────────
print("Obteniendo workflow...")
wf = api_get(f"/workflows/{WF_ID}")
print(f"OK: {wf['name']} | {len(wf['nodes'])} nodos")

# Verificar que los nodos no existan ya
existing_names = {n["name"] for n in wf["nodes"]}
if NAME_ML_Q in existing_names or NAME_ML_SIM in existing_names:
    print("INFO: Los nodos ya existen. Abortando para no duplicar.")
    import sys; sys.exit(0)

# ── 1. Agregar nodos nuevos ───────────────────────────────────────────────────
wf["nodes"].append(NODE_ML_Q)
wf["nodes"].append(NODE_ML_SIM)
print(f"OK Nodos agregados: {NAME_ML_Q}, {NAME_ML_SIM}")

# ── 2. Actualizar conexiones ──────────────────────────────────────────────────
conns = wf["connections"]

# Quitar: Transcripciones -> Build Gemini Prompt
if NAME_TRANS in conns:
    for i, output_list in enumerate(conns[NAME_TRANS].get("main", [])):
        conns[NAME_TRANS]["main"][i] = [
            c for c in output_list if c.get("node") != NAME_BUILD
        ]
    print(f"OK Desconectado: {NAME_TRANS} -> {NAME_BUILD}")

# Agregar: Transcripciones -> Get ML Questions
if NAME_TRANS not in conns:
    conns[NAME_TRANS] = {"main": [[]]}
if not conns[NAME_TRANS].get("main"):
    conns[NAME_TRANS]["main"] = [[]]
conns[NAME_TRANS]["main"][0].append(
    {"node": NAME_ML_Q, "type": "main", "index": 0}
)
print(f"OK Conectado: {NAME_TRANS} -> {NAME_ML_Q}")

# Agregar: Get ML Questions -> Get Similar Products
conns[NAME_ML_Q] = {"main": [[
    {"node": NAME_ML_SIM, "type": "main", "index": 0}
]]}
print(f"OK Conectado: {NAME_ML_Q} -> {NAME_ML_SIM}")

# Agregar: Get Similar Products -> Build Gemini Prompt
conns[NAME_ML_SIM] = {"main": [[
    {"node": NAME_BUILD, "type": "main", "index": 0}
]]}
print(f"OK Conectado: {NAME_ML_SIM} -> {NAME_BUILD}")

# ── 3. Actualizar Build Prompt ────────────────────────────────────────────────
print("Leyendo backup para obtener prompt con tildes correctas...")
with open(BACKUP, encoding="utf-8-sig") as f:
    backup = json.load(f)

orig_build = next(n for n in backup["nodes"] if n["id"] == ID_BUILD)
orig_code  = orig_build["parameters"]["jsCode"]

# Verificar tildes
jam = orig_code.index("JAM")
assert orig_code[jam+3] == "Á", f"Backup corrupto"
print("OK Tildes del backup OK")

# Extraer prefix del prompt (todo hasta // Structured output)
BACKUP_MARKER = "// OpenAI-compatible JSON Schema"
closing_bt    = orig_code.rindex("`", 0, orig_code.index(BACKUP_MARKER))
prompt_part   = orig_code[:closing_bt]  # sin el backtick de cierre

# Inyectar variables de los nuevos nodos al inicio del jsCode
# (antes de las variables existentes)
insert_after = "const bloqueVideos = $('Transcripciones').first().json.bloque_videos;"
prompt_part  = prompt_part.replace(
    insert_after,
    insert_after + "\n" + BUILD_PREPEND
)

# Actualizar instrucciones del prompt para usar datos reales
prompt_part = prompt_part.replace(
    "PREGUNTAS FRECUENTES (FAQ): basándote en las opiniones",
    "PREGUNTAS FRECUENTES (FAQ): tienes disponibles las siguientes preguntas reales de compradores en ML:\n${preguntasML || '(sin preguntas disponibles)'}\n\nBasándote en esas preguntas Y en las opiniones"
)
prompt_part = prompt_part.replace(
    "ALTERNATIVAS EDITORIALES: en el campo",
    "ALTERNATIVAS EDITORIALES: los siguientes productos aparecen en ML en rango de precio similar:\n${similaresMl || '(sin datos de competencia)'}\n\nUsando esa referencia, en el campo"
)

# Schema v3 completo
new_suffix = r"""`;

// OpenAI-compatible JSON Schema v3 — Abacus RouteLLM (claude-sonnet-4-6)
const jsonSchema = {
  type: "object",
  properties: {
    editorial_score:     { type: "number" },
    score_justificacion: { type: "string" },
    sub_scores: {
      type: "array",
      items: {
        type: "object",
        properties: { dimension:{type:"string"}, score:{type:"number"}, justificacion:{type:"string"} },
        required: ["dimension","score","justificacion"],
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
        properties: { tipo:{type:"string"}, autor:{type:"string"}, aporte:{type:"string"} },
        required: ["tipo","autor","aporte"],
        additionalProperties: false
      }
    },
    opiniones_destacadas: {
      type: "array",
      items: {
        type: "object",
        properties: { aspecto:{type:"string"}, resumen:{type:"string"}, sentimiento:{type:"string"} },
        required: ["aspecto","resumen","sentimiento"],
        additionalProperties: false
      }
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        properties: { pregunta:{type:"string"}, respuesta:{type:"string"} },
        required: ["pregunta","respuesta"],
        additionalProperties: false
      }
    },
    precio_valor: { type: "string" },
    alternativas: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo:{type:"string"}, descripcion:{type:"string"} },
        required: ["tipo","descripcion"],
        additionalProperties: false
      }
    },
    seo_title:       { type: "string" },
    seo_description: { type: "string" },
    articulo_html:   { type: "string" }
  },
  required: [
    "editorial_score","score_justificacion","sub_scores","veredicto_corto",
    "compralo_si","saltatelo_si","pros","contras","fuentes_citadas",
    "opiniones_destacadas","faq","precio_valor","alternativas",
    "seo_title","seo_description","articulo_html"
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

new_build_code = prompt_part + new_suffix

# Actualizar el nodo en el workflow
for node in wf["nodes"]:
    if node["id"] == ID_BUILD:
        node["parameters"]["jsCode"] = new_build_code
        print("OK Build Prompt actualizado con datos reales de Q&A + similares")

# ── 4. PUT ────────────────────────────────────────────────────────────────────
print("\nEnviando a n8n...")
result = api_put(f"/workflows/{WF_ID}", {
    "name":        wf["name"],
    "nodes":       wf["nodes"],
    "connections": wf["connections"],
    "settings": {
        "executionOrder": wf["settings"]["executionOrder"],
        "errorWorkflow":  wf["settings"]["errorWorkflow"],
    },
    "staticData": wf.get("staticData"),
})

# ── 5. Verificar ─────────────────────────────────────────────────────────────
node_names = {n["name"] for n in result["nodes"]}
conns_out  = result["connections"]

# Check Transcripciones -> Get ML Questions
trans_conns = [c["node"] for cl in conns_out.get(NAME_TRANS,{}).get("main",[]) for c in cl]
mlq_conns   = [c["node"] for cl in conns_out.get(NAME_ML_Q,{}).get("main",[]) for c in cl]
sim_conns   = [c["node"] for cl in conns_out.get(NAME_ML_SIM,{}).get("main",[]) for c in cl]

n_build = next(n for n in result["nodes"] if n["id"] == ID_BUILD)
code_b  = n_build["parameters"]["jsCode"]

print("\n=== RESULTADO ===")
print(f"Nodo '{NAME_ML_Q}' existe:      {'OK' if NAME_ML_Q in node_names else 'FALTA'}")
print(f"Nodo '{NAME_ML_SIM}' existe:    {'OK' if NAME_ML_SIM in node_names else 'FALTA'}")
print(f"Trans -> GetMLQ:   {'OK' if NAME_ML_Q in trans_conns else 'FALTA'}")
print(f"GetMLQ -> GetSim:  {'OK' if NAME_ML_SIM in mlq_conns else 'FALTA'}")
print(f"GetSim -> Build:   {'OK' if NAME_BUILD in sim_conns else 'FALTA'}")
print(f"Tildes en prompt:  {'OK' if ord(code_b[code_b.index('JAM')+3]) == 0xC1 else 'CORRUPTO'}")
print(f"preguntasML en code: {'OK' if 'preguntasML' in code_b else 'FALTA'}")
print(f"similaresMl en code: {'OK' if 'similaresMl' in code_b else 'FALTA'}")
print(f"Workflow: {result['name']} | Nodos: {len(result['nodes'])} | Activo: {result['active']}")

# Guardar IDs para referencia
print(f"\nIDs generados:")
print(f"  {NAME_ML_Q}:      {ID_ML_Q}")
print(f"  {NAME_ML_SIM}: {ID_ML_SIM}")
