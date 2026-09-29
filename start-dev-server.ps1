$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $projectRoot
$env:AI_VIDEO_STUDIO_PORT = '8055'

Write-Host ''
python server.py
