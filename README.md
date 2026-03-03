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

### Mac — Docker

```bash
cd bridge
docker compose up -d

# First time only — import n8n workflows
N8N_API_KEY=<key-from-n8n-ui> bash n8n/setup.sh
```

### Linux server — pm2

```bash
cd ~/anthropic/bridge
pm2 start npm --name bridge -- start
pm2 start npx --name n8n -- n8n
```

### Windows laptop (office)

Just SSH tunnel — everything runs on the Linux server:
```powershell
ssh -L 3000:localhost:3000 -L 5678:localhost:5678 user@your-linux-server
```

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
npx playwright show-report   # open HTML report in browser
```

On the Linux server, copy the report to your laptop:
```powershell
scp -r user@linux-server:~/anthropic/playwright-report C:\Users\you\Desktop\
```

---

## n8n workflows

| Workflow | Webhook URL | Trigger |
|----------|-------------|---------|
| Snapshot | `http://localhost:5678/webhook/bridge-snapshot` | Zephyr test created |
| Heal | `http://localhost:5678/webhook/bridge-heal` | CI test failure |

n8n UI: **http://localhost:5678** (credentials set during first-run setup)

---

## Git workflow

```bash
# After changes on Mac
git add .
git commit -m "describe your change"
git push

# On Linux server — pull latest
git pull
cd bridge && npm run build   # only if bridge source changed
```
