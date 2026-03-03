# Agentic Playwright Framework

AI-driven test generation and self-healing for Playwright — powered by Claude, n8n, and live DOM snapshots.

---

## What it does

1. **Snapshot** — navigates to a URL, captures the accessibility tree, extracts stable `getByRole()` locators
2. **Generate** — sends the snapshot to Claude API, gets back a ready-to-run `.spec.ts` file
3. **Heal** — when a CI test breaks, takes a fresh snapshot and suggests the corrected locator
4. **Automate** — n8n connects Zephyr webhooks to the bridge so test generation triggers automatically

---

## Project structure

```
├── tests/zephyr/          Playwright spec files (generated + hand-authored)
├── pages/                 Page Object Models (BasePage, LoginPage, CheckboxesPage, DropdownPage)
├── utils/
│   ├── env.ts             requireEnv(), appCredentials() — safe env var access
│   └── zephyr.ts          zephyrStep(), zephyrExpected() — Zephyr step wrappers
├── bridge/                Standalone Express microservice
│   ├── src/
│   │   ├── routes/        /health  /snapshot  /heal  /generate-spec
│   │   ├── services/      browser.ts (Playwright singleton), claude.ts (Anthropic SDK)
│   │   └── middleware/    apiKey.ts (x-api-key guard)
│   ├── test-cases/        One .md file per application
│   ├── n8n/               Importable n8n workflow JSONs + setup.sh
│   ├── run-from-md.js     Cross-platform driver (Windows / Mac / Linux)
│   ├── run-from-md.sh     Bash driver (Mac / Linux)
│   ├── Dockerfile         Production container for bridge
│   └── docker-compose.yml Bridge + n8n together
├── playwright.config.ts   Multi-project config (public-chromium, chromium, firefox, mobile-chrome)
├── .env.example           Template — copy to .env and fill in secrets
└── README.md              This file
```

---

## Setup

### Prerequisites
- Node.js 18+
- (Mac) Docker Desktop for `docker compose` workflow
- (Linux server) nvm, pm2

### 1. Install dependencies

```bash
npm install
npx playwright install chromium

cd bridge
npm install
npm run build
```

### 2. Configure environment

```bash
cp .env.example .env
cp bridge/.env.example bridge/.env
```

Edit `.env`:
```
BASE_URL=https://your-app.com
THE_INTERNET_USERNAME=tomsmith
THE_INTERNET_PASSWORD=SuperSecretPassword!
MY_APP_USERNAME=qa@yourcompany.com
MY_APP_PASSWORD=your_password
```

Edit `bridge/.env`:
```
ANTHROPIC_API_KEY=sk-ant-your-key-here
BRIDGE_API_KEY=any-secret-string
PORT=3000
```

---

## Running

### Architecture

```
Linux server  ──  bridge (port 3000) + n8n (port 5678) + report server (port 9323)
Windows laptop ── SSH tunnel → browser only (no local install needed)
```

Everything runs on the Linux box. The Windows laptop connects via SSH tunnel and
uses a browser to access n8n and the Playwright HTML report.

---

### Linux server — first-time setup (automated)

Run this single command on the Linux box — it handles everything:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/vkharish/agenticplaywright/main/setup-linux.sh)
```

The script will:
1. Install nvm + Node.js 20 (if not already installed)
2. Install pm2 globally
3. Clone the repo (or pull latest if already cloned)
4. Install all dependencies + Playwright chromium
5. Prompt for your `ANTHROPIC_API_KEY` and write `bridge/.env`
6. Start the bridge with pm2
7. Optionally start n8n and the HTML report server
8. Print the SSH tunnel command for your Windows laptop

No Docker required.

---

### Linux server — manual setup (step by step)

If you prefer to run each step yourself:

```bash
# 1. Install Node.js via nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 20

# 2. Clone repo
git clone git@github.com:vkharish/agenticplaywright.git ~/anthropic

# 3. Install root deps + Playwright browser
cd ~/anthropic
npm install
npx playwright install chromium --with-deps

# 4. Build bridge
cd bridge
npm install
npm run build

# 5. Configure environment
cp ~/anthropic/.env.example ~/anthropic/.env
# Edit ~/anthropic/.env — add your app credentials (username/password)

cat > ~/anthropic/bridge/.env << 'EOF'
BRIDGE_API_KEY=dev-key
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
PORT=3000
EOF

# 6. Install pm2
npm install -g pm2

# 7. Start bridge
pm2 start npm --name bridge -- start --prefix ~/anthropic/bridge

# 8. (Optional) start n8n and report server
pm2 start npx --name n8n -- n8n
pm2 start "npx serve playwright-report -l 9323" --name report --cwd ~/anthropic

# Save so services restart on reboot
pm2 save
pm2 startup   # follow the printed instruction once
```

### Linux server — import n8n workflows (first time only)

In n8n UI (via SSH tunnel below): **Settings → API → Create an API key**

```bash
N8N_API_KEY=<key-from-n8n-ui> bash ~/anthropic/bridge/n8n/setup.sh
```

This imports and activates all 4 workflows.

### Windows laptop — SSH tunnel

Open PowerShell and keep this running whenever you work:

```powershell
ssh -L 3000:localhost:3000 -L 5678:localhost:5678 -L 9323:localhost:9323 user@your-linux-server
```

Then open in your browser:
- **n8n UI**: http://localhost:5678
- **HTML report**: http://localhost:9323
- **Bridge health**: http://localhost:3000/health

---

## Generating specs from a .md file

### 1. Create a test-case file

`bridge/test-cases/my-app.md`:
```markdown
# My App

## Login
testId: QA-MYAPP-01
url: https://myapp.com/login
credentials: MY_APP
description: Main login form

## Dashboard
testId: QA-MYAPP-02
url: https://myapp.com/dashboard
description: Post-login landing page
```

### 2. Run

```bash
# Mac / Linux
bash bridge/run-from-md.sh bridge/test-cases/my-app.md

# Windows (through SSH tunnel)
node bridge/run-from-md.js bridge\test-cases\my-app.md
```

Generated specs land in `tests/zephyr/QA-MYAPP-01.spec.ts` etc.

### 3. Run the specs

```bash
npx playwright test tests/zephyr/QA-MYAPP-01.spec.ts --project=chromium
npx playwright show-report
```

---

## Bridge API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Service + browser status |
| POST | `/snapshot` | `x-api-key` | DOM snapshot + locators |
| POST | `/heal` | `x-api-key` | Fix a broken locator |
| POST | `/generate-spec` | `x-api-key` | Snapshot → Claude → `.spec.ts` |

All requests except `/health` require header: `x-api-key: <BRIDGE_API_KEY>`

### Example — snapshot

```bash
curl -X POST http://localhost:3000/snapshot \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{"url": "https://myapp.com/login"}'
```

### Example — heal

```bash
curl -X POST http://localhost:3000/heal \
  -H "Content-Type: application/json" \
  -H "x-api-key: dev-key" \
  -d '{
    "url": "https://myapp.com/login",
    "brokenLocator": "page.getByRole('\''button'\'', { name: '\''Sign in'\'' })",
    "errorMessage": "resolved to 0 elements",
    "context": "login submit button"
  }'
```

---

## Credentials

Credentials are **never hardcoded**. They live only in `.env`:

```
# Pattern: <APP_PREFIX>_USERNAME / <APP_PREFIX>_PASSWORD
MY_APP_USERNAME=qa@mycompany.com
MY_APP_PASSWORD=secure_password
```

In specs, access via:
```typescript
import { appCredentials } from '../../utils/env';
const { username, password } = appCredentials('MY_APP');
```

In test-cases `.md`, reference the prefix:
```
credentials: MY_APP
```

---

## Reports

Three reporters run automatically on every test run:

| Reporter | Output | Use |
|----------|--------|-----|
| `list` | Console (live) | Real-time feedback |
| `html` | `playwright-report/index.html` | Full step-by-step with screenshots/video |
| `junit` | `test-results/junit.xml` | CI integration (Jenkins, GitHub Actions, Azure DevOps) |

```bash
npx playwright show-report   # open HTML report in browser (local)
```

On Linux with pm2 report server running, view from any Windows browser via SSH tunnel:
```
http://localhost:9323
```

Or copy the report to your laptop:
```powershell
scp -r user@linux-server:~/anthropic/playwright-report C:\Users\you\Desktop\
```

---

## n8n workflows

| Workflow | How to trigger | What it does |
|----------|---------------|--------------|
| **Snapshot** | Webhook `POST /webhook/bridge-snapshot` | Takes a live DOM snapshot of a URL |
| **Heal** | Webhook `POST /webhook/bridge-heal` | Suggests a fix for a broken locator |
| **Generate Specs** | Click "Run" in n8n UI | Reads `.md` file → snapshots → Claude → writes `.spec.ts` files |
| **Run Tests** | Click "Run" in n8n UI | Runs `npx playwright test` on the Linux box |

n8n UI: **http://localhost:5678** (via SSH tunnel from Windows)

### Typical Windows-browser workflow

1. Open http://localhost:5678 in your browser
2. Open **"Bridge — Generate Specs from MD"** → click **Run** → specs are generated on Linux
3. Open **"Bridge — Run Playwright Tests"** → click **Run** → tests execute on Linux
4. Open http://localhost:9323 to view the HTML report in your browser

---

## Git workflow

```bash
# On Linux server — after making changes
git add .
git commit -m "describe your change"
git push

# Pull latest (e.g. after editing on another machine)
git pull
cd bridge && npm run build   # only if bridge/ source changed
pm2 restart bridge           # apply the new build
```
