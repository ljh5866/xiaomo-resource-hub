<#
  本地一条命令部署到服务器
    .\deploy-remote.ps1                 # 默认 admin@43.103.48.5
    .\deploy-remote.ps1 -Target admin@1.2.3.4

  做三件事：把本地未推送的提交推上去 → SSH 执行 deploy.sh → 结束后显示本次耗时与提交号
#>
param(
  [string]$Target = "admin@43.103.48.5",
  [string]$AppDir = "/var/www/xiaomo"
)

$ErrorActionPreference = "Stop"
$repo = Split-Path $PSScriptRoot -Parent

Push-Location $repo
try {
  $dirty = git status --porcelain
  if ($dirty) {
    Write-Host "! 工作区有未提交的改动，先提交再部署：" -ForegroundColor Yellow
    git status --short
    return
  }

  Write-Host "→ 推送本地提交到 GitHub ..." -ForegroundColor Yellow
  git push origin main
  $head = (git rev-parse --short HEAD).Trim()
  Write-Host "  当前提交：$head" -ForegroundColor Gray
}
finally {
  Pop-Location
}

Write-Host "→ 在服务器上执行 deploy.sh（会短暂中断服务）..." -ForegroundColor Yellow
$start = Get-Date

ssh $Target "cd $AppDir && sudo bash deploy/deploy.sh"

$cost = [math]::Round(((Get-Date) - $start).TotalSeconds)
Write-Host "`n✓ 完成，用时 ${cost}s" -ForegroundColor Green
Write-Host "  站点 https://ttals.com   后台 https://admin.ttals.com" -ForegroundColor Gray
