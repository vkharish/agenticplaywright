# setup-windows.ps1 — one-shot setup for Windows (no admin rights needed)
#
# Run once in PowerShell:
#   Set-ExecutionPolicy -Scope CurrentUser RemoteSigned   (one-time, no admin)
#   .\setup-windows.ps1
#
# What it does:
#   1. Checks Node.js is available
#   2. Clones the repo (or pulls latest)
#   3. Installs all dependencies
#   4. Builds the bridge
#   5. Prompts for API key and writes .env files
#   6. Starts bridge in a background PowerShell window

$ErrorActionPreference = "Stop"
$REPO_URL   = "git@github.com:vkharish/agenticplaywright.git"
$INSTALL_DIR = "$env:USERPROFILE\anthropic"

function Write-Step { param($msg) Write-Host "`n>> $msg" -ForegroundColor Green }
function Write-Warn  { param($msg) Write-Host "   $msg" -ForegroundColor Yellow }

# ── 1. Node.js check ──────────────────────────────────────────────────────────
Write-Step "Checking Node.js..."
try {
    $nodeVer = node --version
    Write-Host "   Node.js $nodeVer found." -ForegroundColor Green
} catch {
    Write-Host @"

Node.js not found. Install the portable ZIP (no admin needed):
  1. Go to https://nodejs.org/en/download
  2. Download: Windows Binary (.zip) 64-bit
  3. Extract to: $env:USERPROFILE\node
  4. Add to PATH:
       [System.Environment]::SetEnvironmentVariable(
         'PATH',
         [System.Environment]::GetEnvironmentVariable('PATH','User') + ';$env:USERPROFILE\node',
         'User'
       )
  5. Restart PowerShell and re-run this script.

"@ -ForegroundColor Red
    exit 1
}

# ── 2. Git check ──────────────────────────────────────────────────────────────
Write-Step "Checking Git..."
try {
    $gitVer = git --version
    Write-Host "   $gitVer found." -ForegroundColor Green
} catch {
    Write-Host @"

Git not found. Install the portable version (no admin needed):
  1. Go to https://git-scm.com/download/win
  2. Download: 64-bit Git for Windows Portable
  3. Extract to: $env:USERPROFILE\git
  4. Add $env:USERPROFILE\git\bin to PATH (same method as Node.js above)
  5. Restart PowerShell and re-run this script.

"@ -ForegroundColor Red
    exit 1
}

# ── 3. Clone / pull repo ──────────────────────────────────────────────────────
Write-Step "Setting up repository at $INSTALL_DIR..."
if (Test-Path "$INSTALL_DIR\.git") {
    Write-Warn "Repo already cloned — pulling latest..."
    git -C $INSTALL_DIR pull
} else {
    git clone $REPO_URL $INSTALL_DIR
}

Set-Location $INSTALL_DIR

# ── 4. Install root dependencies ──────────────────────────────────────────────
Write-Step "Installing root dependencies..."
npm install

Write-Step "Installing Playwright browser (Chromium)..."
# No --with-deps on Windows — browsers are self-contained
npx playwright install chromium

# ── 5. Install bridge dependencies + build ────────────────────────────────────
Write-Step "Installing bridge dependencies..."
npm install --prefix "$INSTALL_DIR\bridge"

Write-Step "Building bridge..."
npm run build --prefix "$INSTALL_DIR\bridge"

# ── 6. Write .env files ───────────────────────────────────────────────────────
Write-Step "Configuring environment..."

$rootEnv = "$INSTALL_DIR\.env"
if (-not (Test-Path $rootEnv)) {
    Copy-Item "$INSTALL_DIR\.env.example" $rootEnv
    Write-Warn "Root .env created — edit it to add your app credentials:"
    Write-Warn "  $rootEnv"
}

$bridgeEnv = "$INSTALL_DIR\bridge\.env"
if (-not (Test-Path $bridgeEnv)) {
    Write-Host ""
    $anthropicKey = Read-Host "  Enter your ANTHROPIC_API_KEY (sk-ant-...)"
    $bridgeKey    = Read-Host "  Enter BRIDGE_API_KEY (press Enter to use 'dev-key')"
    if ([string]::IsNullOrWhiteSpace($bridgeKey)) { $bridgeKey = "dev-key" }

    @"
BRIDGE_API_KEY=$bridgeKey
ANTHROPIC_API_KEY=$anthropicKey
PORT=3000
"@ | Set-Content $bridgeEnv
    Write-Host "   bridge\.env written." -ForegroundColor Green
} else {
    Write-Warn "bridge\.env already exists — skipping."
}

# ── 7. Start bridge in background PowerShell window ───────────────────────────
Write-Step "Starting bridge..."
Start-Process powershell -ArgumentList "-NoExit", "-Command", `
    "Set-Location '$INSTALL_DIR\bridge'; npm start" `
    -WindowStyle Normal

Start-Sleep -Seconds 3

try {
    $health = Invoke-RestMethod "http://localhost:3000/health" -TimeoutSec 5
    Write-Host "   Bridge is up — status: $($health.status)" -ForegroundColor Green
} catch {
    Write-Warn "Bridge may still be starting — check the bridge window."
}

# ── 8. Done ───────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=" * 60 -ForegroundColor Green
Write-Host " Setup complete!" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Green
Write-Host ""
Write-Host "  Generate specs:"
Write-Host "    node $INSTALL_DIR\generate.js bridge\test-cases\the-internet.md"
Write-Host ""
Write-Host "  Run tests:"
Write-Host "    npx playwright test --project=public-chromium"
Write-Host ""
Write-Host "  View report:"
Write-Host "    npx playwright show-report"
Write-Host ""
Write-Host "  Bridge health:"
Write-Host "    http://localhost:3000/health"
Write-Host ""
Write-Warn "The bridge is running in a separate PowerShell window."
Write-Warn "Keep that window open while working."
Write-Warn "To start it again later:"
Write-Warn "  cd $INSTALL_DIR\bridge && npm start"
