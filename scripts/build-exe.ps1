# build-exe.ps1 — ساخت EXE ویندوز Peak — همه‌کاره، ضدخرابی
# خودش: نصب وابستگی ← بیلد Next ← Node قابل‌حمل ← نوشتن config قطعی ← electron-builder ← جمع‌آوری EXE
$ErrorActionPreference = "Continue"

function Fail($msg) {
  Write-Host "::error::$msg"
  if ($env:GITHUB_STEP_SUMMARY) { Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value ("`nFAILED: " + $msg) }
  exit 1
}

Write-Host "== diagnostics =="
Write-Host ("node: " + (node -v) + "   npm: " + (npm -v))

# ---------- 0) پاک‌سازی خروجی قبلی ----------
# بدون این کار، EXE های کهنهٔ مانده در dist جمع‌آوری و منتشر می‌شوند (علت ریشه‌ای «لینک Latest نسخهٔ قدیمی را می‌دهد»)
if (Test-Path "dist") { Remove-Item "dist" -Recurse -Force }
Remove-Item "dist-log.txt", "npm-log.txt", "package-check.txt" -Force -ErrorAction SilentlyContinue
Write-Host "dist cleaned OK"

# فعال‌سازی مسیرهای طولانی ویندوز (رفع خطای طول مسیر هنگام بسته‌بندی node_modules)
try {
  reg add "HKLM\SYSTEM\CurrentControlSet\Control\FileSystem" /v LongPathsEnabled /t REG_DWORD /d 1 /f | Out-Null
  git config --system core.longpaths true 2>$null
  Write-Host "long paths enabled OK"
} catch {
  Write-Host "long paths: could not enable (continuing)"
}

# ---------- 1) نصب وابستگی‌ها — با fallback هوشمند (رفع ناهماهنگی lock) ----------
Write-Host "== npm ci =="
npm ci --no-audit --no-fund --include=dev 2>&1 | Tee-Object -FilePath npm-log.txt
if ($LASTEXITCODE -ne 0) {
  Write-Host "npm ci failed - trying npm install (self-heal: lock mismatch / missing lock)"
  npm install --no-audit --no-fund --include=dev 2>&1 | Tee-Object -FilePath npm-log.txt
  if ($LASTEXITCODE -ne 0) {
    $nt = ((Get-Content "npm-log.txt" -Tail 20 | Out-String) -replace "`r?`n", " | ").Trim()
    Fail ("npm install FAILED - LOG: " + $nt)
  }
}
if (-not (Test-Path "node_modules/electron-builder/cli.js")) { Fail "electron-builder NOT INSTALLED (node_modules/electron-builder/cli.js missing)" }
Write-Host "electron-builder found OK"

# ---------- 2) بیلد Next ----------
npm run build
if ($LASTEXITCODE -ne 0) { Fail "next build FAILED" }
if (-not (Test-Path ".next/BUILD_ID")) { Fail "next build produced no .next/BUILD_ID" }

# ---------- 3) Node قابل‌حمل برای داخل بسته ----------
# حیاتی: بدون این پوشه، برنامه روی سیستمی که Node ندارد باز نمی‌شود
# (علت ریشه‌ای «نصب شد ولی باز نشد» — resources/node/node.exe داخل بسته نبود)
$v = "v22.11.0"
if (Test-Path "vendor/node") { Remove-Item "vendor/node" -Recurse -Force }
if (Test-Path "node-tmp") { Remove-Item "node-tmp" -Recurse -Force }
if (Test-Path "node.zip") { Remove-Item "node.zip" -Force }
try {
  Invoke-WebRequest ("https://nodejs.org/dist/" + $v + "/node-" + $v + "-win-x64.zip") -OutFile node.zip
  Expand-Archive node.zip -DestinationPath node-tmp -Force
} catch {
  Fail ("دانلود/استخراج Node قابل‌حمل ناموفق بود (" + $v + ") — " + $_.Exception.Message)
}
New-Item -ItemType Directory -Force -Path vendor | Out-Null
Move-Item ("node-tmp/node-" + $v + "-win-x64") "vendor/node" -Force
Remove-Item node.zip -Force -ErrorAction SilentlyContinue
Remove-Item node-tmp -Recurse -Force -ErrorAction SilentlyContinue

# بررسی قطعی — اگر Node داخل بسته نباشد، همان‌جا با پیام گویا رد شو،
# نه اینکه EXE ای منتشر شود که روی سیستم کاربر باز نمی‌شود
if (-not (Test-Path "vendor/node/node.exe")) {
  Fail ("vendor/node/node.exe ساخته نشد — Node قابل‌حمل داخل بسته نیست (مسیر: " + (Resolve-Path "vendor" -ErrorAction SilentlyContinue) + ")")
}
if (-not (Test-Path "vendor/node/node_modules/npm/bin/npm-cli.js")) {
  Write-Host "::warning::npm داخل Node قابل‌حمل پیدا نشد — مرحلهٔ بازسازی better-sqlite3 ممکن است انجام نشود"
}
Write-Host ("bundled node OK: " + (& vendor\node\node.exe --version))

# ---------- 3.5) بررسی سازگاری better-sqlite3 با Node داخل بسته (علت رایج باز نشدن) ----------
Write-Host "== verify native ABI with bundled node =="
& vendor\node\node.exe -e "try{require('better-sqlite3');console.log('ABI-OK')}catch(e){console.error('ABI-FAIL: '+e.message);process.exit(1)}"
if ($LASTEXITCODE -ne 0) {
  Write-Host "ABI mismatch - rebuilding better-sqlite3 with bundled node..."
  $env:PATH = (Resolve-Path "vendor\node").Path + ";" + $env:PATH
  & vendor\node\node.exe vendor\node\node_modules\npm\bin\npm-cli.js rebuild better-sqlite3
  if ($LASTEXITCODE -ne 0) { Fail "better-sqlite3 rebuild FAILED" }
  & vendor\node\node.exe -e "require('better-sqlite3');console.log('ABI-OK-after-rebuild')"
  if ($LASTEXITCODE -ne 0) { Fail "better-sqlite3 still incompatible with bundled node" }
}

# ---------- 4) نوشتن config قطعی و قابل‌اعتماد ----------
$cfg = @(
  'appId: com.peak.desktop',
  'productName: Peak',
  # نام اجرایی پین‌شده — میان‌برها همیشه به Peak.exe اشاره می‌کنند (رفع کلاس خطای Missing Shortcut)
  'executableName: Peak',
  'directories:',
  '  output: dist',
  '  buildResources: build',
  'npmRebuild: false',
  'asar: false',
  # Node قابل‌حمل داخل بسته — حیاتی! بدون این، برنامه به Node سیستم نیاز دارد
  'extraResources:',
  '  - from: vendor/node',
  '    to: node',
  'files:',
  '  - ".next/**/*"',
  '  - "electron/**/*"',
  '  - "public/**/*"',
  '  - "next.config.mjs"',
  '  - "tsconfig.json"',
  '  - "package.json"',
  '  - "!node_modules/minecraft-data/minecraft-data/data/bedrock/**"',
  '  - "!node_modules/minecraft-data/minecraft-data/doc/**"',
  '  - "!node_modules/minecraft-data/minecraft-data/tools/**"',
  '  - "!node_modules/**/test/**"',
  '  - "!node_modules/**/tests/**"',
  '  - "!node_modules/**/*.md"',
  '  - "!node_modules/**/README*"',
  '  - "!node_modules/@next/swc-linux-*/**"',
  '  - "!node_modules/@next/swc-darwin-*/**"',
  '  - "!node_modules/@img/sharp-linux*/**"',
  '  - "!node_modules/@img/sharp-darwin-*/**"',
  'win:',
  '  icon: build/icon.ico',
  '  target:',
  '    - target: nsis',
  '      arch: [x64]',
  '    - target: portable',
  '      arch: [x64]',
  'nsis:',
  '  oneClick: false',
  '  allowToChangeInstallationDirectory: true',
  '  createDesktopShortcut: true',
  '  createStartMenuShortcut: true',
  '  shortcutName: Peak',
  '  artifactName: "Peak-Setup-${version}.${ext}"',
  'portable:',
  '  artifactName: "Peak-Portable-${version}.${ext}"'
)
$cfg | Set-Content -Path "electron-builder.generated.yml" -Encoding UTF8
Write-Host "generated config written OK"

# ---------- 4.5) تضمین سلامت icon.ico — خوددرمانی آیکون ----------
$pngPath = "build/icon.png"
$icoPath = "build/icon.ico"
$needIcon = $true
if ((Test-Path $icoPath)) {
  $b = [System.IO.File]::ReadAllBytes($icoPath)
  # ساختار سالم: type=1, count=1, PNG در offset 22
  if ($b.Length -gt 30 -and $b[2] -eq 1 -and $b[4] -eq 1 -and $b[22] -eq 0x89 -and $b[23] -eq 0x50) { $needIcon = $false }
}
if ($needIcon) {
  if (-not (Test-Path $pngPath)) { Fail "icon.ico خراب است و build/icon.png هم پیدا نشد — هر دو فایل را در build/ بگذار" }
  Write-Host "icon.ico invalid - rebuilding from icon.png (self-heal)"
  $png = [System.IO.File]::ReadAllBytes($pngPath)
  # بررسی حداقل ۲۵۶×۲۵۶ از روی هدر PNG
  $w = ([int]$png[16] -shl 24) -bor ([int]$png[17] -shl 16) -bor ([int]$png[18] -shl 8) -bor [int]$png[19]
  $h = ([int]$png[20] -shl 24) -bor ([int]$png[21] -shl 16) -bor ([int]$png[22] -shl 8) -bor [int]$png[23]
  if ($w -lt 256 -or $h -lt 256) { Fail ("icon.png must be at least 256x256 - now " + $w + "x" + $h) }
  $ms = New-Object System.IO.MemoryStream
  $bw = New-Object System.IO.BinaryWriter($ms)
  $bw.Write([uint16]0); $bw.Write([uint16]1); $bw.Write([uint16]1)
  $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0); $bw.Write([byte]0)
  $bw.Write([uint16]1); $bw.Write([uint16]32)
  $bw.Write([uint32]$png.Length); $bw.Write([uint32]22)
  $bw.Write($png)
  [System.IO.File]::WriteAllBytes($icoPath, $ms.ToArray())
  $bw.Dispose()
  Write-Host "icon.ico rebuilt OK"
} else {
  Write-Host "icon.ico valid OK"
}

# ---------- 5) اجرای electron-builder — سه تلاش خودکار ----------
# تلاش ۱: ساخت کامل | تلاش ۲: بدون ویرایش/امضای exe (مشکلات آیکون/cedit) | تلاش ۳: فقط نسخهٔ unpacked
$eb = 1
foreach ($attempt in @("full", "no-edit", "dir-only")) {
  Write-Host "== electron-builder start ($attempt) =="
  if ($attempt -eq "full") {
    node ./node_modules/electron-builder/cli.js --win --publish=never --config electron-builder.generated.yml 2>&1 | Tee-Object -FilePath dist-log.txt
  } elseif ($attempt -eq "no-edit") {
    node ./node_modules/electron-builder/cli.js --win --publish=never --config electron-builder.generated.yml --config.win.signAndEditExecutable=false 2>&1 | Tee-Object -FilePath dist-log.txt
  } else {
    node ./node_modules/electron-builder/cli.js --win --dir --publish=never --config electron-builder.generated.yml 2>&1 | Tee-Object -FilePath dist-log.txt
  }
  $eb = $LASTEXITCODE
  Write-Host ("== electron-builder exit (" + $attempt + "): " + $eb + " ==")
  if ($eb -eq 0) { break }
}

# ---------- 6) جمع‌آوری همهٔ EXEها از کل پروژه ----------
New-Item -ItemType Directory -Force -Path dist | Out-Null
$exes = Get-ChildItem -Path "." -Recurse -Filter "*.exe" -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -notmatch "node_modules|vendor" }
foreach ($f in $exes) {
  Write-Host ("FOUND: " + $f.FullName + " (" + [math]::Round($f.Length / 1MB, 1) + " MB)")
  Copy-Item $f.FullName ("dist\" + $f.Name) -Force
}
$final = @(Get-ChildItem "dist" -Filter "*.exe" -ErrorAction SilentlyContinue)
Write-Host "== dist contents =="
Get-ChildItem "dist" -ErrorAction SilentlyContinue | Format-Table Name, Length

# ---------- 6.5) بازرسی بستهٔ ساخته‌شده ----------
# همان دو موردی که قبلاً بی‌صدا خراب می‌شد: resources/node/node.exe و resources/app/.next/BUILD_ID
# در گیت‌هاب، همین بررسی به‌صورت مرحلهٔ جداگانه اجرا و در خلاصهٔ run نوشته می‌شود؛
# اینجا فقط برای اجرای محلی (powershell -File scripts\build-exe.ps1) تکرار می‌شود.
if (-not $env:GITHUB_ACTIONS) {
  Write-Host "== package check (local) =="
  node scripts/tools.mjs package-check --no-summary
}

# ---------- 7) گزارش روی صفحهٔ run ----------
$tail = ""
if (Test-Path "dist-log.txt") { $tail = (Get-Content "dist-log.txt" -Tail 30 | Out-String) }
$sum = "`n## Peak build report`n"
$sum += ("- electron-builder exit: " + $eb + "`n")
$sum += ("- exe collected: " + $final.Count + "`n")
foreach ($f in $final) { $sum += ("- " + $f.Name + " (" + [math]::Round($f.Length / 1MB, 1) + " MB)`n") }
$sum += "`n### electron-builder log tail`n" + $tail
if ($env:GITHUB_STEP_SUMMARY) { Add-Content -Path $env:GITHUB_STEP_SUMMARY -Value $sum }

if ($eb -ne 0) {
  # علت دقیق را داخل همان پیام خطا می‌گذاریم تا با کپی Error مشخص شود
  $oneline = ($tail -replace "`r?`n", " | " ).Trim()
  if ($oneline.Length -gt 500) { $oneline = $oneline.Substring($oneline.Length - 500) }
  Fail ("electron-builder FAILED - LOG TAIL: " + $oneline)
}
if ($final.Count -eq 0) {
  $oneline = ($tail -replace "`r?`n", " | ").Trim()
  Fail ("NO EXE PRODUCED - LOG TAIL: " + $oneline)
}
Write-Host ("SUCCESS: " + $final.Count + " exe file(s) in dist/")
