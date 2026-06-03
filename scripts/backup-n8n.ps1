# Exporta todos los workflows de n8n al directorio n8n-backup/
# Requiere que n8n esté corriendo en http://localhost:5678
# Uso: .\scripts\backup-n8n.ps1 [API_KEY]
#
# Para generar el API key: n8n UI → Settings → n8n API → Create API Key

param(
  [string]$ApiKey = $env:N8N_API_KEY
)

$base = "http://localhost:5678/api/v1"
$outDir = Join-Path $PSScriptRoot "..\n8n-backup"
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$headers = @{ "Accept" = "application/json" }
if ($ApiKey) { $headers["X-N8N-API-KEY"] = $ApiKey }

try {
  $workflows = (Invoke-RestMethod -Uri "$base/workflows" -Headers $headers).data
} catch {
  Write-Error "No se pudo conectar a n8n. Asegurate de que esté corriendo en localhost:5678."
  exit 1
}

foreach ($wf in $workflows) {
  $detail = Invoke-RestMethod -Uri "$base/workflows/$($wf.id)" -Headers $headers
  $filename = "$($wf.id)_$($wf.name -replace '[\\/:*?""<>|]', '-').json"
  $detail | ConvertTo-Json -Depth 20 | Set-Content -Path (Join-Path $outDir $filename) -Encoding utf8
  Write-Host "Exportado: $filename"
}

Write-Host "`n✅ $($workflows.Count) workflows exportados en n8n-backup/"
