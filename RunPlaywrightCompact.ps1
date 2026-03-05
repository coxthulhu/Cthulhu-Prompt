param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$PlaywrightArgs
)

# Buffer output so successful runs stay compact.
$allOutput = @()

$env:VITE_LOG_LEVEL = 'warn'
$buildOutput = & npm run build 2>&1
$buildExitCode = $LASTEXITCODE
$allOutput += $buildOutput

if ($buildExitCode -ne 0) {
  $allOutput | ForEach-Object { Write-Output $_ }
  exit $buildExitCode
}

$env:DEV_ENVIRONMENT = 'PLAYWRIGHT'
$testOutput = & npx playwright test @PlaywrightArgs 2>&1
$testExitCode = $LASTEXITCODE
$allOutput += $testOutput

if ($testExitCode -eq 0) {
  Write-Output 'PASS'
  exit 0
}

$allOutput | ForEach-Object { Write-Output $_ }
exit $testExitCode
