# 从 Windows 推送并执行 bootstrap（仅公钥登录）
#   .\deploy\push.ps1                     # 只上传
#   .\deploy\push.ps1 -Run                # 上传并执行 bootstrap
#   .\deploy\push.ps1 -Target root@1.2.3.4
param(
  [string]$Target = "root@43.103.48.5",
  [switch]$Run
)
$ErrorActionPreference = 'Stop'
$key  = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$repo = Split-Path $PSScriptRoot -Parent
$opts = @('-o','IdentitiesOnly=yes','-o','StrictHostKeyChecking=accept-new','-o','ConnectTimeout=10','-i',$key)

if (-not (Test-Path $key)) { throw "缺少私钥：$key（先 ssh-keygen -t ed25519 -f $key）" }

Write-Host "→ 验证公钥登录 $Target ..." -ForegroundColor Yellow
& ssh @opts $Target 'echo OK: $(hostname) $(id -un)'
if ($LASTEXITCODE -ne 0) {
  Write-Host "公钥未被接受 —— 先在服务商控制台/VNC 里把 $key.pub 的内容追加到 ~/.ssh/authorized_keys" -ForegroundColor Red
  exit 1
}

Write-Host "→ 上传 bootstrap-ubuntu.sh ..." -ForegroundColor Yellow
& scp @opts (Join-Path $PSScriptRoot 'bootstrap-ubuntu.sh') "${Target}:/root/"
if ($LASTEXITCODE -ne 0) { throw "scp 失败" }

if ($Run) {
  Write-Host "→ 执行 bootstrap ..." -ForegroundColor Yellow
  & ssh @opts $Target 'bash /root/bootstrap-ubuntu.sh'
  if ($LASTEXITCODE -ne 0) { throw "bootstrap 失败" }
  Write-Host "✓ 完成。接着 clone 代码到 /var/www/xiaomo 并跑 deploy/install.sh" -ForegroundColor Green
} else {
  Write-Host "✓ 上传完成：${Target}:/root/bootstrap-ubuntu.sh" -ForegroundColor Green
  Write-Host "  执行：ssh ${Target} 'bash /root/bootstrap-ubuntu.sh'"
}
