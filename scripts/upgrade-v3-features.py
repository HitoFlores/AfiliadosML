"""
upgrade-v3-features.py
Implementa mejoras v3 en el pipeline n8n:
  1. YouTube: quita relevanceLanguage=es → resultados globales (inglés + español)
  2. Build Prompt: agrega FAQ, precio_valor, alternativas al schema + instrucciones
  3. Build Final JSON: incluye los nuevos campos en el output
Uso: python scripts/upgrade-v3-features.py
"""
import json, urllib.request, sys, os

API_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMmVjOThiOS1hOTRhLTQ4Y2YtYjBkZC1jNTdmMDE0ZGVkMmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDZhYzA3MzctYjgyNS00NDliLTllNWUtYWUwNjVlYWEyNzU4IiwiaWF0IjoxNzgwNDQwOTQ5LCJleHAiOjE3ODA5Nzc2MDB9.bL-eFulsjvfTPkk3-4YTNK_2HeBNgTDJSqSw3IamuF8"
WF_ID    = "iSQ59pcFepjqmBvC"
BASE     = "http://localhost:5678/api/v1"
HDRS     = {"X-N8N-API-KEY": API_KEY, "Content-Type": "application/json"}
BACKUP   = os.path.join(os.path.dirname(__file__), "..", "n8n-backup",
                        "iSQ59pcFepjqmBvC_AfiliadosML.json")

# Node IDs
ID_YT_SEARCH  = "af3cab7a-7f15-4a28-ab93-49561388b7a0"  # Get Videos YT
ID_BUILD      = "944acde7-4624-4ddd-96f5-a8e11898b46d"  # Build Abacus Prompt
ID_FINAL      = "df9c2a23-3d8a-4abf-aad4-fd07971aeeaf"  # Build Final JSON

def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

def api_put(path, body):
    data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    req  = urllib.request.Request(f"{BASE}{path}", data=data, method="PUT", headers=HDRS)
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read().decode("utf-8"))

# ── 1. Nuevo suffix del prompt (v3) ──────────────────────────────────────────
# Se inserta ANTES del cierre del template literal del prompt (antes de la última `)

NEW_PROMPT_SECTION = r"""

PREGUNTAS FRECUENTES (FAQ): basándote en las opiniones de compradores y los videos disponibles, genera entre 3 y 5 FAQ que respondan las dudas reales que tiene un comprador serio antes de comprar. Elige preguntas sobre rendimiento, compatibilidad, durabilidad, relación precio-calidad o casos de uso específicos. IGNORA preguntas de logística, envío, garantía del vendedor, colores disponibles o disponibilidad de stock. Si no hay evidencia suficiente para responder una pregunta con honestidad, no la incluyas. Campo "faq": array de objetos con "pregunta" y "respuesta".

ANÁLISIS PRECIO-VALOR: en el campo "precio_valor", escribe 2-3 frases respondiendo directamente "¿Vale la pena a este precio?". Compara lo que ofrece el producto con lo que cuesta. Sé directo: si es caro para lo que da, dilo claramente. Si es buen valor, justifícalo con evidencia concreta de las fuentes. No menciones el precio exacto (puede variar), habla en términos relativos (caro, accesible, competitivo, etc.).

ALTERNATIVAS EDITORIALES: en el campo "alternativas", sugiere exactamente 2 opciones sin inventar marcas o modelos específicos:
- Primera: tipo "Opción más económica" — describe qué tipo de producto buscar con menor presupuesto y qué se sacrifica respecto a este modelo.
- Segunda: tipo "Opción premium" — describe qué se gana gastando más y en qué situaciones vale la pena el gasto extra."""

# ── 2. Nuevos campos del JSON Schema (OpenAI format) ─────────────────────────
NEW_SCHEMA_FIELDS = r"""    faq: {
      type: "array",
      items: {
        type: "object",
        properties: { pregunta: { type: "string" }, respuesta: { type: "string" } },
        required: ["pregunta", "respuesta"],
        additionalProperties: false
      }
    },
    precio_valor: { type: "string" },
    alternativas: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo: { type: "string" }, descripcion: { type: "string" } },
        required: ["tipo", "descripcion"],
        additionalProperties: false
      }
    },"""

# ── 3. Nuevos campos en Build Final JSON ─────────────────────────────────────
FINAL_JSON_INJECTION = """    faq:           parsedAbacus.faq || [],
    precio_valor:  parsedAbacus.precio_valor || null,
    alternativas:  parsedAbacus.alternativas || [],"""

# ── Main ─────────────────────────────────────────────────────────────────────
print("Leyendo backup...")
with open(BACKUP, encoding="utf-8-sig") as f:
    backup = json.load(f)

# Obtener jsCode original del backup para Build Prompt (tildes correctas)
orig_build = next(n for n in backup["nodes"] if n["id"] == ID_BUILD)
orig_code  = orig_build["parameters"]["jsCode"]

# Verificar tildes
jam = orig_code.index("JAM")
assert orig_code[jam+3] == "Á", f"Backup corrupto: char={orig_code[jam+3]!r}"
print("OK Backup tiene tildes correctas")

# El backup tiene el marker VIEJO de Gemini (antes de migración a Abacus)
# El prompt_prefix correcto (con tildes) está en el backup hasta "// Structured output"
BACKUP_MARKER = "// Structured output"
backup_prompt_end = orig_code.index(BACKUP_MARKER)
# prompt_part = todo hasta el cierre del template literal (el ` antes del marker)
# El template literal cierra con `;\n\n antes del marker
closing_backtick_idx = orig_code.rindex("`", 0, backup_prompt_end)
prompt_part = orig_code[:closing_backtick_idx]  # sin el backtick de cierre

# Nuevo suffix con schema expandido (incluyendo FAQ, precio_valor, alternativas)
new_suffix = r"""`;

// OpenAI-compatible JSON Schema — Abacus RouteLLM (claude-sonnet-4-6) v3
const jsonSchema = {
  type: "object",
  properties: {
    editorial_score:     { type: "number" },
    score_justificacion: { type: "string" },
    sub_scores: {
      type: "array",
      items: {
        type: "object",
        properties: { dimension: { type: "string" }, score: { type: "number" }, justificacion: { type: "string" } },
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
        properties: { tipo: { type: "string" }, autor: { type: "string" }, aporte: { type: "string" } },
        required: ["tipo", "autor", "aporte"],
        additionalProperties: false
      }
    },
    opiniones_destacadas: {
      type: "array",
      items: {
        type: "object",
        properties: { aspecto: { type: "string" }, resumen: { type: "string" }, sentimiento: { type: "string" } },
        required: ["aspecto", "resumen", "sentimiento"],
        additionalProperties: false
      }
    },
    faq: {
      type: "array",
      items: {
        type: "object",
        properties: { pregunta: { type: "string" }, respuesta: { type: "string" } },
        required: ["pregunta", "respuesta"],
        additionalProperties: false
      }
    },
    precio_valor: { type: "string" },
    alternativas: {
      type: "array",
      items: {
        type: "object",
        properties: { tipo: { type: "string" }, descripcion: { type: "string" } },
        required: ["tipo", "descripcion"],
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
    "opiniones_destacadas", "faq", "precio_valor", "alternativas",
    "seo_title", "seo_description", "articulo_html"
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

new_build_code = prompt_part + NEW_PROMPT_SECTION + new_suffix
print("OK Build Prompt: prompt con nuevas instrucciones + schema v3 expandido")

# ── GET workflow actual ───────────────────────────────────────────────────────
print("Obteniendo workflow de n8n...")
wf = api_get(f"/workflows/{WF_ID}")
print(f"OK Workflow: {wf['name']} | {len(wf['nodes'])} nodos")

# ── Parchear nodos ────────────────────────────────────────────────────────────
for node in wf["nodes"]:
    nid    = node["id"]
    params = node.get("parameters", {})

    # 1. YouTube: quitar relevanceLanguage=es
    if nid == ID_YT_SEARCH:
        url = params.get("url", "")
        if "relevanceLanguage=es&" in url:
            params["url"] = url.replace("relevanceLanguage=es&", "")
            print("OK Get Videos YT: relevanceLanguage=es eliminado")
        elif "relevanceLanguage=es" in url:
            params["url"] = url.replace("&relevanceLanguage=es", "").replace("relevanceLanguage=es", "")
            print("OK Get Videos YT: relevanceLanguage=es eliminado")
        else:
            print("INFO Get Videos YT: relevanceLanguage=es ya no estaba")

    # 2. Build Prompt: prompt + schema expandidos
    if nid == ID_BUILD:
        params["jsCode"] = new_build_code
        print("OK Build Prompt: actualizado con FAQ / precio_valor / alternativas")

    # 3. Build Final JSON: agregar nuevos campos al output
    if nid == ID_FINAL:
        code = params.get("jsCode", "")
        if "faq:" not in code:
            # Insertar después de "fuentesCitadas" en el return
            OLD_FUENTES = "fuentes_citadas:   parsedAbacus.fuentes_citadas || [],"
            if OLD_FUENTES in code:
                params["jsCode"] = code.replace(
                    OLD_FUENTES,
                    OLD_FUENTES + "\n    " + FINAL_JSON_INJECTION.strip()
                )
                print("OK Build Final JSON: faq / precio_valor / alternativas agregados")
            else:
                print("WARN Build Final JSON: no encontre el anchor, saltando")
        else:
            print("INFO Build Final JSON: campos ya existían")

    # Fix regex mangleado (por si acaso)
    code = params.get("jsCode", "")
    if code and "[`-?]" in code:
        params["jsCode"] = code.replace("[`-?]", r"[̀-ͯ]")
        print(f"OK Fix regex en {node['name']}")

# ── PUT ───────────────────────────────────────────────────────────────────────
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

# ── Verificar ─────────────────────────────────────────────────────────────────
n_build = next(n for n in result["nodes"] if n["id"] == ID_BUILD)
n_final = next(n for n in result["nodes"] if n["id"] == ID_FINAL)
n_yt    = next(n for n in result["nodes"] if n["id"] == ID_YT_SEARCH)

code_b = n_build["parameters"]["jsCode"]
code_f = n_final["parameters"]["jsCode"]
url_yt = n_yt["parameters"].get("url", "")

jam2 = code_b.index("JAM")
tildes_ok = code_b[jam2+3] == "A" or ord(code_b[jam2+3]) == 0xC1

print("\n=== RESULTADO ===")
print(f"Tildes en prompt:    {'OK' if tildes_ok else 'CORRUPTO'} (byte={ord(code_b[jam2+3])})")
print(f"FAQ en schema:       {'OK' if 'faq' in code_b else 'FALTA'}")
print(f"precio_valor schema: {'OK' if 'precio_valor' in code_b else 'FALTA'}")
print(f"alternativas schema: {'OK' if 'alternativas' in code_b else 'FALTA'}")
print(f"FAQ en final JSON:   {'OK' if 'faq' in code_f else 'FALTA'}")
print(f"YT sin lang filter:  {'OK' if 'relevanceLanguage' not in url_yt else 'SIGUE TENIENDO'}")
print(f"Workflow: {result['name']} | Activo: {result['active']}")
