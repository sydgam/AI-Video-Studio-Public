param([switch]$Restart)
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ttsRoot = Join-Path $env:LOCALAPPDATA 'AI-Video-Studio-TTS'
$ttsPython = Join-Path $ttsRoot 'venv\Scripts\python.exe'

if (-not (Test-Path -LiteralPath $ttsPython)) {
  exit 0
}

$listener = Get-NetTCPConnection -LocalAddress '127.0.0.1' -LocalPort 8060 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
  if (-not $Restart) {
    try {
      $health = Invoke-RestMethod 'http://127.0.0.1:8060/health' -TimeoutSec 3
      if ($health.projectRoot -ne $projectRoot) {
        Write-Warning 'TTS is running from another or older project. Run tools/launchers/START-TTS.cmd to restart it from this folder.'
      }
    } catch { Write-Warning 'Port 8060 is occupied but TTS is not responding.' }
    exit 0
  }
  foreach ($connection in $listener) {
    $ttsProcess = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
    if ($ttsProcess.CommandLine -notmatch 'uvicorn\s+app:app' -or $ttsProcess.CommandLine -notmatch 'local-tts') {
      throw 'Port 8060 belongs to another application. It was not stopped.'
    }
    Stop-Process -Id $connection.OwningProcess -Force
    Wait-Process -Id $connection.OwningProcess -Timeout 10 -ErrorAction SilentlyContinue
  }
}

$env:HF_HOME = Join-Path $ttsRoot 'models'
$env:HF_HUB_OFFLINE = '1'
$env:TRANSFORMERS_OFFLINE = '1'
$logRoot = Join-Path $projectRoot '.runtime\tts'
New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
$env:NUMBA_CACHE_DIR = Join-Path $logRoot 'numba'
$arguments = @(
  '-m', 'uvicorn', 'app:app',
  '--app-dir', ('"' + (Join-Path $projectRoot 'local-tts') + '"'),
  '--host', '127.0.0.1',
  '--port', '8060'
)

Start-Process -FilePath $ttsPython -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $logRoot 'stdout.log') -RedirectStandardError (Join-Path $logRoot 'stderr.log')
