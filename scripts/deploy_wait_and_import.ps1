$service='fairshare-lite'
$max=60
$i=0
while($i -lt $max){
  try {
    $sRaw = railway service status --service $service --json 2>$null
  } catch {
    $sRaw = $null
  }
  if(-not $sRaw){
    Write-Host 'Failed to read service status'
    Start-Sleep -s 5
    $i++
    continue
  }
  $sObj = $sRaw | ConvertFrom-Json
  Write-Host ('Service status: ' + $sObj.status)
  if($sObj.status -ne 'BUILDING'){ break }
  Start-Sleep -s 5
  $i++
}
if($i -ge $max){ Write-Host 'Timed out waiting for deploy'; exit 2 }
Write-Host 'Calling import endpoint...'
try {
  $imp = Invoke-RestMethod -Uri 'https://fairshare-lite-production.up.railway.app/api/admin/import-expenses' -Method Post -UseBasicParsing -TimeoutSec 120
  Write-Host 'Import response:'
  $imp | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host 'Import request failed:'
  Write-Host $_.Exception.Message
}
Write-Host 'Calling demo-login...'
try {
  $demo = Invoke-RestMethod -Uri 'https://fairshare-lite-production.up.railway.app/api/auth/demo-login' -Method Post -Body (ConvertTo-Json @{username='demo_user'}) -ContentType 'application/json' -UseBasicParsing -TimeoutSec 60
  Write-Host 'Demo response:'
  $demo | ConvertTo-Json -Depth 5 | Write-Host
} catch {
  Write-Host 'Demo login failed:'
  Write-Host $_.Exception.Message
}
