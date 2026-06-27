# ─────────────────────────────────────────────────────────────────────────────
# Leventia — local code-signing + trust (UNBLOCKS YOUR OWN MACHINE)
#
# Smart App Control / SmartScreen block UNSIGNED apps. There is no code change that
# bypasses that — it's the whole point of the feature. The only real fixes are:
#   1. A trusted code-signing certificate (see SIGNING.md — Azure Trusted Signing).
#   2. (this script) Sign with a self-signed cert + trust it ON THIS MACHINE.
#
# This makes Windows on THIS PC trust the build. It does NOT help other people's
# PCs — for distribution you need a real cert.
#
# RUN AS ADMINISTRATOR. You'll get one Windows prompt to add the cert to the
# trusted root — click YES.
# ─────────────────────────────────────────────────────────────────────────────

$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$pfx  = Join-Path $root 'build\leventia.pfx'
$cer  = Join-Path $root 'build\leventia.cer'
$pwd  = ConvertTo-SecureString 'leventia' -AsPlainText -Force

# 1. Ensure the self-signed code-signing cert exists (create + export if not).
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq 'CN=Leventia Software, O=Leventia' } | Select-Object -First 1
if (-not $cert) {
  Write-Host 'Creating self-signed code-signing certificate...'
  $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject 'CN=Leventia Software, O=Leventia' `
    -CertStoreLocation Cert:\CurrentUser\My -KeyExportPolicy Exportable -KeySpec Signature `
    -HashAlgorithm SHA256 -NotAfter (Get-Date).AddYears(5)
  New-Item -ItemType Directory -Force (Join-Path $root 'build') | Out-Null
  Export-PfxCertificate -Cert $cert -FilePath $pfx -Password $pwd | Out-Null
  Export-Certificate   -Cert $cert -FilePath $cer | Out-Null
}
Write-Host "Using cert: $($cert.Thumbprint)"

# 2. Trust it on this machine (LocalMachine = covers all users + services like SAC).
Write-Host 'Adding the cert to Trusted Root + Trusted Publishers (click YES on the prompt)...'
Import-Certificate -FilePath $cer -CertStoreLocation Cert:\LocalMachine\Root          | Out-Null
Import-Certificate -FilePath $cer -CertStoreLocation Cert:\LocalMachine\TrustedPublisher | Out-Null

# 3. Sign the installed app exe AND the Setup installer (both, so SAC accepts each).
$targets = @()
$targets += Get-ChildItem (Join-Path $root 'release\*.exe') -ErrorAction SilentlyContinue
$targets += Get-ChildItem (Join-Path $root 'release\win-unpacked\Leventia Alting.exe') -ErrorAction SilentlyContinue
foreach ($t in $targets) {
  $r = Set-AuthenticodeSignature -FilePath $t.FullName -Certificate $cert -TimestampServer 'http://timestamp.digicert.com' -HashAlgorithm SHA256
  Write-Host ("  {0,-55} {1}" -f $t.Name, $r.Status)
}

Write-Host ''
Write-Host 'Done. If Smart App Control STILL blocks it, SAC is in its strict mode for'
Write-Host 'unknown apps — either get a real cert (SIGNING.md) or turn SAC off:'
Write-Host '  Windows Security -> App & browser control -> Smart App Control -> Off'
