# Creates the backend's PostgreSQL role and databases (run once).
# psql asks for the password of your "postgres" superuser; the app's own password is read from backend/.env.
#   powershell -ExecutionPolicy Bypass -File backend/scripts/create_db.ps1

$ErrorActionPreference = "Stop"
$envFile = Join-Path $PSScriptRoot "..\.env"
$values = @{}
foreach ($line in [IO.File]::ReadAllLines($envFile)) {
  if ($line -match '^\s*([A-Z_]+)\s*=\s*(.*)$') { $values[$Matches[1]] = $Matches[2].Trim() }
}

$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"
if (-not (Test-Path -LiteralPath $psql)) { $psql = "psql" }

& $psql -U postgres -h $values["DB_HOST"] -p $values["DB_PORT"] -d postgres `
  -v ON_ERROR_STOP=1 `
  -v db_user="$($values['DB_USER'])" `
  -v db_password="$($values['DB_PASSWORD'])" `
  -v db_name="$($values['DB_NAME'])" `
  -v test_db_name="$($values['TEST_DB_NAME'])" `
  -f (Join-Path $PSScriptRoot "create_db.sql")

if ($LASTEXITCODE -eq 0) { Write-Host "Database role and databases are ready." -ForegroundColor Green }
