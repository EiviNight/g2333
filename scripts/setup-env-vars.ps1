# 一次性：把环境变量写入 Cloudflare Pages 项目
#
# 凭据不写死在文件里。运行前先设置：
#   $env:CF_API_KEY   = "你的 Cloudflare Global API Key"
#   $env:CF_EMAIL     = "你的 Cloudflare 账号邮箱"
#   $env:ADMIN_PASS   = "要设置的登录口令"
#   $env:SESSION_SEC  = "会话签名密钥（见 README 的生成命令）"
#
# 这个文件可以安全提交，因为它只读环境变量，不含任何密钥。
$ErrorActionPreference = 'Stop'

$key   = $env:CF_API_KEY
$email = $env:CF_EMAIL
$acct  = $env:CF_ACCOUNT_ID
if (-not $acct) { $acct = "4e686a896fee598af2f2228029d68764" }
$proj  = "g2333"

if (-not $key)   { throw "缺少环境变量 CF_API_KEY" }
if (-not $email) { throw "缺少环境变量 CF_EMAIL" }
if (-not $env:ADMIN_PASS)  { throw "缺少环境变量 ADMIN_PASS" }
if (-not $env:SESSION_SEC) { throw "缺少环境变量 SESSION_SEC" }

$headers = @{
  "X-Auth-Key"   = $key
  "X-Auth-Email" = $email
  "Content-Type" = "application/json"
}

$payload = @{
  deployment_configs = @{
    production = @{
      env_vars = @{
        ADMIN_USER     = @{ type = "secret_text"; value = "eivi" }
        ADMIN_PASSWORD = @{ type = "secret_text"; value = $env:ADMIN_PASS }
        SESSION_SECRET = @{ type = "secret_text"; value = $env:SESSION_SEC }
      }
    }
  }
} | ConvertTo-Json -Depth 10

$uri = "https://api.cloudflare.com/client/v4/accounts/$acct/pages/projects/$proj"

try {
  $r = Invoke-RestMethod -Uri $uri -Headers $headers -Method Patch -Body $payload -TimeoutSec 60
  $prod = $r.result.deployment_configs.production
  Write-Host "success = $($r.success)"
  Write-Host "env_vars: " + (($prod.env_vars.PSObject.Properties | ForEach-Object { $_.Name }) -join ', ')
  Write-Host "r2_buckets: " + (($prod.r2_buckets.PSObject.Properties | ForEach-Object { $_.Name }) -join ', ')
  Write-Host "d1_databases: " + (($prod.d1_databases.PSObject.Properties | ForEach-Object { $_.Name }) -join ', ')
} catch {
  Write-Host "failed: $($_.Exception.Message)"
  if ($_.ErrorDetails) { Write-Host $_.ErrorDetails.Message }
  exit 1
}
