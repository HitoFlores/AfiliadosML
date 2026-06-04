
# fix-nodes-abacus.ps1
# Restaura el prompt correcto del backup y configura Abacus en los 3 nodos
# Corre este script en TU terminal (no via Claude)
# Uso: .\scripts\fix-nodes-abacus.ps1

$apiKey  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkMmVjOThiOS1hOTRhLTQ4Y2YtYjBkZC1jNTdmMDE0ZGVkMmIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiMDZhYzA3MzctYjgyNS00NDliLTllNWUtYWUwNjVlYWEyNzU4IiwiaWF0IjoxNzgwNDQwOTQ5LCJleHAiOjE3ODA5Nzc2MDB9.bL-eFulsjvfTPkk3-4YTNK_2HeBNgTDJSqSw3IamuF8"
$wfId    = "iSQ59pcFepjqmBvC"
$baseUrl = "http://localhost:5678/api/v1"
$hdrs    = @{ "X-N8N-API-KEY" = $apiKey }

Write-Host "Leyendo backup..."
$backup  = Get-Content "$PSScriptRoot\..\n8n-backup\iSQ59pcFepjqmBvC_AfiliadosML.json" -Raw -Encoding UTF8 | ConvertFrom-Json
$origCode = ($backup.nodes | Where-Object { $_.id -eq "944acde7-4624-4ddd-96f5-a8e11898b46d" }).parameters.jsCode

# Verificar que el backup tiene tildes correctas
$b = [System.Text.Encoding]::UTF8.GetBytes($origCode.Substring($origCode.IndexOf("JAM"), 6))
Write-Host "Backup - byte de A en JAMAS: $($b[3]) (195 = correcto, 63 = corrupto)"
if ($b[3] -ne 195) { Write-Error "Backup corrupto. Abortar."; exit 1 }

# Prefix: todo el prompt hasta // Structured output
$prefix = $origCode.Substring(0, $origCode.IndexOf("// Structured output"))

# Suffix nuevo: schema OpenAI para Abacus (todo ASCII)
$suffix = @'
// OpenAI-compatible JSON Schema — Abacus RouteLLM (claude-sonnet-4-6)
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
'@

$newBuildCode = $prefix + $suffix

# GET workflow actual
Write-Host "Obteniendo workflow de n8n..."
$wf = Invoke-RestMethod -Uri "$baseUrl/workflows/$wfId" -Headers $hdrs

# Parchear nodos
foreach ($node in $wf.nodes) {
    # Nodo 1: Restaurar prompt correcto + schema Abacus
    if ($node.id -eq "944acde7-4624-4ddd-96f5-a8e11898b46d") {
        $node.parameters.jsCode = $newBuildCode
        Write-Host "OK Nodo 1 (Build Prompt): restaurado desde backup + schema Abacus"
    }
    # Nodo 2: URL y headers Abacus (ya deberían estar bien)
    if ($node.id -eq "a84059f1-5377-4585-9932-43aa54117b78") {
        $node.parameters.url = "https://routellm.abacus.ai/v1/chat/completions"
        $node.parameters.sendQuery = $false
        $node.parameters.queryParameters = [PSCustomObject]@{ parameters = @() }
        $node.parameters.headerParameters = [PSCustomObject]@{
            parameters = @(
                [PSCustomObject]@{ name = "Content-Type";  value = "application/json" },
                [PSCustomObject]@{ name = "Authorization"; value = '={{ "Bearer " + $env.ABACUS_API_KEY }}' }
            )
        }
        Write-Host "OK Nodo 2 (HTTP): URL + auth Abacus"
    }
    # Nodo 3: Parser OpenAI
    if ($node.id -eq "bea74d95-9d2c-4ff5-a3c9-40e17b6d4851") {
        $node.parameters.jsCode = @'
const raw = $input.first().json.choices[0].message.content;
let parsed;
try {
  parsed = JSON.parse(raw);
} catch (e) {
  throw new Error('Abacus parse error: ' + e.message + ' | Raw: ' + raw.substring(0, 200));
}
return [{ json: parsed }];
'@
        Write-Host "OK Nodo 3 (Parse): choices[0].message.content"
    }
    # Fix regex mangleado en Build Final JSON
    if ($node.parameters.jsCode -and $node.parameters.jsCode.Contains('[`-?]')) {
        $node.parameters.jsCode = $node.parameters.jsCode.Replace('[`-?]', '[̀-ͯ]')
        Write-Host "OK Build Final JSON: regex restaurado"
    }
}

# Serializar a JSON
$putJson = @{
    name        = $wf.name
    nodes       = $wf.nodes
    connections = $wf.connections
    settings    = [PSCustomObject]@{
        executionOrder = $wf.settings.executionOrder
        errorWorkflow  = $wf.settings.errorWorkflow
    }
    staticData  = $wf.staticData
} | ConvertTo-Json -Depth 50

# Escribir a archivo temp UTF-8 sin BOM
$tmp = [System.IO.Path]::GetTempFileName() + ".json"
[System.IO.File]::WriteAllText($tmp, $putJson, [System.Text.UTF8Encoding]::new($false))
Write-Host "JSON temporal: $tmp"

# PUT via curl.exe (maneja UTF-8 correctamente)
Write-Host "Enviando a n8n..."
$curlOut = & curl.exe -s -X PUT "http://localhost:5678/api/v1/workflows/$wfId" `
    -H "X-N8N-API-KEY: $apiKey" `
    -H "Content-Type: application/json" `
    --data-binary "@$tmp"

Remove-Item $tmp -Force

# Verificar resultado
$result = $curlOut | ConvertFrom-Json
$n1 = $result.nodes | Where-Object { $_.id -eq "944acde7-4624-4ddd-96f5-a8e11898b46d" }
if ($n1) {
    $b2 = [System.Text.Encoding]::UTF8.GetBytes($n1.parameters.jsCode.Substring($n1.parameters.jsCode.IndexOf("JAM"), 6))
    $ok = $b2[3] -eq 195
    Write-Host "`n=== RESULTADO ==="
    Write-Host "Tildes en prompt: $(if($ok){'CORRECTAS ✅'}else{'CORRUPTAS ❌ (byte=$($b2[3]))'}) "
    $n4 = $result.nodes | Where-Object { $_.id -eq "df9c2a23-3d8a-4abf-aad4-fd07971aeeaf" }
    Write-Host "Build Final regex: $(if($n4.parameters.jsCode.Contains('[`-?]')){'ROTO ❌'}else{'CORRECTO ✅'})"
    Write-Host "Workflow: $($result.name) | Activo: $($result.active)"
} else {
    Write-Host "Error en la respuesta. Respuesta raw:"
    Write-Host $curlOut
}
