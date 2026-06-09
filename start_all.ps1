# Start all Legal Multi-Agent System services (Windows)
# Registry first, then leaf agents, then orchestrators

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "Starting Registry service on port 10000..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "registry" -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host "Starting Tax Agent on port 10102..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "tax_agent" -WindowStyle Normal

Write-Host "Starting Compliance Agent on port 10103..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "compliance_agent" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host "Starting Law Agent on port 10101..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "law_agent" -WindowStyle Normal
Start-Sleep -Seconds 3

Write-Host "Starting Customer Agent on port 10100..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "customer_agent" -WindowStyle Normal
Start-Sleep -Seconds 2

Write-Host "Starting UI Gateway on port 10200..."
Start-Process -FilePath "uv" -ArgumentList "run", "python", "-m", "gateway" -WindowStyle Normal

Write-Host ""
Write-Host "All services started in separate windows:"
Write-Host "  Registry:         http://localhost:10000"
Write-Host "  Customer Agent:   http://localhost:10100"
Write-Host "  Law Agent:        http://localhost:10101"
Write-Host "  Tax Agent:        http://localhost:10102"
Write-Host "  Compliance Agent: http://localhost:10103"
Write-Host "  UI Gateway:       http://localhost:10200"
Write-Host ""
Write-Host "Wait ~10 seconds, then start UI:"
Write-Host "  .\start_ui.ps1"
Write-Host ""
Write-Host "Or test CLI:"
Write-Host "  uv run python test_client.py"
Write-Host ""
Write-Host "Close each agent window to stop services."
