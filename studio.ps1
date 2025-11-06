$DB_PATH = Get-ChildItem .wrangler\state\v3\d1\miniflare-D1DatabaseObject\*.sqlite | 
           Sort-Object LastWriteTime -Descending | 
           Select-Object -First 1 -ExpandProperty FullName

if (-not $DB_PATH) {
  Write-Error "No local D1 database file found. Run 'wrangler dev' first."
  exit 1
}

$env:LOCAL_DB_PATH = $DB_PATH
Write-Host "Using local DB: $DB_PATH"
npx drizzle-kit studio