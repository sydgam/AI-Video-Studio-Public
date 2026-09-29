$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$listener = Get-NetTCPConnection -LocalPort 8055 -State Listen -ErrorAction SilentlyContinue
foreach ($connection in $listener) {
    $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($connection.OwningProcess)"
    if ($process.Name -notmatch '^python' -or $process.CommandLine -notmatch 'server.py|run-studio-background.py') { throw 'Unexpected process on Studio port.' }
    Stop-Process -Id $process.ProcessId
}
$env:AI_VIDEO_STUDIO_PORT = '8055'
Start-Process -FilePath 'C:\Python314\python.exe' -ArgumentList @('"' + (Join-Path $PSScriptRoot 'run-studio-background.py') + '"') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $projectRoot '.runtime/studio.stdout.log') -RedirectStandardError (Join-Path $projectRoot '.runtime/studio.stderr.log')
