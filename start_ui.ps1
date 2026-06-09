# Start Agent Orchestrator UI (from agent-orchestrator-hub)
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location "$ProjectRoot\ui"

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
    Write-Host "Installing Bun..."
    powershell -ExecutionPolicy ByPass -c "irm bun.sh/install.ps1 | iex"
    $env:Path = "$env:USERPROFILE\.bun\bin;$env:Path"
}

if (-not (Test-Path "node_modules")) {
    Write-Host "Installing UI dependencies (bun install)..."
    bun install
}

Write-Host ""
Write-Host "Starting UI at http://localhost:5173"
Write-Host "Open Playground tab to chat with multi-agent system."
Write-Host "Requires: start_all.ps1 (agents + gateway on :10200)"
Write-Host ""

bun run dev
