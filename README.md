# Agentic Playwright Framework

AI-driven test generation and self-healing for Playwright — powered by Claude and live DOM snapshots.

---

## What it does

1. **Snapshot** — navigates to a URL, captures the accessibility tree, extracts stable `getByRole()` locators
2. **Generate** — sends the snapshot to Claude, gets back a ready-to-run `.spec.ts` file
3. **Heal** — when a CI test breaks, takes a fresh snapshot and suggests the corrected locator
4. **Automate** — n8n connects Zephyr webhooks to the bridge so test generation triggers automatically

---

## Architecture

```
Option 1 (preferred) — Windows runs everything
  Windows  ── bridge + Playwright + generate.js + tests
             n8n, Jira, Jenkins all reachable directly from Windows browser

Option 2 — Linux box runs everything
  Linux    ── bridge + Playwright + generate.js + tests + n8n
  Windows  ── SSH tunnel → browser only
```

**Option 1 is preferred** — no admin rights needed on Windows, and everything (n8n, Jira, Jenkins, your app UI) is directly reachable from the Windows browser without SSH tunnels.

---

## Project structure

```
├── generate.js                    Standalone spec generator — no bridge, no n8n needed
├── setup-windows.ps1              One-shot Windows setup script (no admin rights needed)
├── setup-linux.sh                 One-shot Linux setup script (run once on a fresh box)
├── Jenkinsfile                    Jenkins pipeline — run tests + auto-heal on failure
├── playwright.config.ts           Multi-project config (public-chromium, chromium, firefox, mobile-chrome)
├── .env.example                   Template — copy to .env, add app credentials
│
├── scripts/
│   └── heal-on-failure.js         Parses junit.xml → calls bridge /heal → prints suggested fixes
│
├── tests/
│   └── zephyr/
│       ├── QA-INTERNET-01.spec.ts Login & Logout
│       ├── QA-INTERNET-02.spec.ts Checkboxes
│       ├── QA-INTERNET-03.spec.ts Dropdown
│       ├── QA-INTERNET-04.spec.ts Invalid credentials error path
│       └── QA-TEMPLATE.spec.ts    Template for new specs
│
├── pages/                         Page Object Models
│   ├── BasePage.ts                navigate(), waitForLoad()
│   ├── LoginPage.ts               login(), assertSecureArea()
│   ├── CheckboxesPage.ts          toggleCheckbox(), assertStates()
│   └── DropdownPage.ts            pickOption(), assertSelectedValue()
│
├── utils/
│   ├── env.ts                     requireEnv(), optionalEnv(), appCredentials(prefix)
│   └── zephyr.ts                  zephyrStep(), zephyrExpected() — Zephyr step wrappers
│
├── bridge/                        Express microservice (needed for n8n + Jenkins heal)
│   ├── src/
│   │   ├── index.ts               Entry point — loads dotenv, registers all routes
│   │   ├── routes/
│   │   │   ├── health.ts          GET  /health
│   │   │   ├── snapshot.ts        POST /snapshot
│   │   │   ├── heal.ts            POST /heal
│   │   │   ├── generate.ts        POST /generate-spec  (needs ANTHROPIC_API_KEY)
│   │   │   └── writeSpec.ts       POST /write-spec     (for n8n LLM node flow)
│   │   ├── services/
│   │   │   ├── browser.ts         Playwright singleton — one browser, many requests
│   │   │   └── claude.ts          Anthropic SDK — generateSpec()
│   │   ├── middleware/
│   │   │   └── apiKey.ts          x-api-key header guard
│   │   └── utils/
│   │       └── aria.ts            ariaSnapshot parser → getByRole() suggestions
│   ├── test-cases/
│   │   ├── the-internet.md        Test cases for https://the-internet.herokuapp.com
│   │   └── my-app.md              Template — edit this for your own app
│   ├── n8n/
│   │   ├── snapshot-workflow.json      Webhook → /snapshot → respond
│   │   ├── heal-workflow.json          Webhook → /heal → respond
│   │   ├── generate-specs-workflow.json Manual trigger → run-from-md.js
│   │   ├── run-tests-workflow.json     Manual trigger → npx playwright test
│   │   └── setup.sh                    Imports all 4 workflows via n8n API
│   ├── run-from-md.js             Spec generator via bridge HTTP API (supports --snapshot-only)
│   ├── run-from-md.sh             Bash version of run-from-md.js
│   └── .env.example               Template — copy to bridge/.env, add ANTHROPIC_API_KEY
│
├── CONTEXT.md                     Full technical context for Claude (AI handoff document)
└── PITCH.md                       Management pitch — ROI, roadmap, proof points
```

---

## Two ways to generate specs

### Option A — Standalone `generate.js` (recommended for getting started)

No bridge, no Docker, no n8n. One script does everything.

```
.md file → Playwright (direct) → Claude API → .spec.ts
```

**Use this when:** testing locally, getting started, no n8n yet.

**Skips existing specs automatically** — only generates specs for test cases that don't already have a `.spec.ts`. Safe to run repeatedly; never overwrites working tests or wastes API calls.

```bash
# Normal run — only generates new test cases
node generate.js bridge/test-cases/my-app.md

# Regenerate everything (after a major page redesign)
node generate.js bridge/test-cases/my-app.md --force
```

### Option B — Bridge + `run-from-md.js` (needed for n8n)

Bridge runs as a persistent HTTP service. n8n (or any tool) calls it.

```
.md file → HTTP → bridge → Playwright → Claude API → .spec.ts
```

**Use this when:** wiring up corporate n8n, CI self-healing, or sharing one browser across many callers.

Same skip-existing default applies. Use `--force` to regenerate all.

### Option C — Corporate n8n with built-in LLM node (no API key on Linux)

n8n handles the Claude call using its own managed key. Bridge only does Playwright + file writing.

```
n8n: /snapshot → LLM Node (Claude, corporate key) → /write-spec → .spec.ts
```

**Use this when:** your corporate n8n already has Claude access and you can't manage API keys yourself.

---

## Getting started on Linux

### Automated setup (one command)

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/vkharish/agenticplaywright/main/setup-linux.sh)
```

The script:
1. Installs nvm + Node.js 20
2. Installs pm2 globally
3. Clones the repo (or pulls latest)
4. Installs all dependencies + Playwright chromium
5. Prompts for `ANTHROPIC_API_KEY` and writes `bridge/.env`
6. Starts bridge with pm2
7. Optionally starts n8n and report server
8. Prints the SSH tunnel command for Windows

### Manual setup (step by step)

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
cd bridge && npm install && npm run build && cd ..

# 5. Configure environment
cp .env.example .env
# Edit .env — add app credentials

cat > bridge/.env << 'EOF'
BRIDGE_API_KEY=dev-key
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
PORT=3000
EOF

# 6. Install pm2 and start bridge
npm install -g pm2
pm2 start npm --name bridge -- start --prefix ~/anthropic/bridge
pm2 save
pm2 startup   # follow the printed instruction once
```

---

## Windows setup

Node.js and Git are already installed — no additional installs needed.

### What needs admin rights? — Nothing

| What | Admin needed? |
|------|--------------|
| npm install | ❌ No |
| Playwright Chromium | ❌ No — downloads to your user folder |
| Bridge service | ❌ No — runs in a PowerShell window |

---

### First-time setup

**Step 1 — Allow PowerShell scripts (one time)**
```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

**Step 2 — Clone and run setup script**
```powershell
git clone git@github.com:vkharish/agenticplaywright.git $env:USERPROFILE\anthropic
cd $env:USERPROFILE\anthropic
.\setup-windows.ps1
```

The script installs all deps, builds the bridge, prompts for your `ANTHROPIC_API_KEY`, and starts the bridge in a background window.

---

### Manual setup (if you prefer step by step)

```powershell
# 1. Clone repo
git clone git@github.com:vkharish/agenticplaywright.git $env:USERPROFILE\anthropic
cd $env:USERPROFILE\anthropic

# 2. Install deps + Playwright browser
npm install
npx playwright install chromium

# 3. Build bridge
cd bridge
npm install
npm run build
cd ..

# 4. Configure .env files
copy .env.example .env
notepad .env          # add your app credentials

copy bridge\.env.example bridge\.env
notepad bridge\.env   # add ANTHROPIC_API_KEY

# 5. Start bridge (keep this window open)
cd bridge
npm start
```

---

### Daily workflow

Open **two PowerShell windows**:

```powershell
# Window 1 — bridge (keep open while working)
cd $env:USERPROFILE\anthropic\bridge
npm start
```

```powershell
# Window 2 — generate and test
cd $env:USERPROFILE\anthropic

# Generate specs from .md file
node generate.js bridge/test-cases/the-internet.md

# Run tests
npx playwright test --project=public-chromium

# View HTML report (opens in browser)
npx playwright show-report
```

---

### Day 1 — Generate specs with standalone script (no bridge needed)

```bash
# Generate specs for test website
node generate.js bridge/test-cases/the-internet.md

# Run the generated specs
npx playwright test --project=chromium

# View HTML report
npx playwright show-report
```

### Day 2 — Generate specs through bridge (verify bridge works)

```bash
# Confirm bridge is up
curl http://localhost:3000/health

# Generate specs via bridge
node bridge/run-from-md.js bridge/test-cases/the-internet.md

# Run tests + report
npx playwright test --project=chromium
npx playwright show-report
```

### Day 3 — Add your own app

```bash
# 1. Create test cases file for your app
cp bridge/test-cases/my-app.md bridge/test-cases/your-app.md
# Edit it — add your app URLs, testIds, credentials prefix

# 2. Add credentials to .env
echo "YOUR_APP_USERNAME=qa@yourcompany.com" >> .env
echo "YOUR_APP_PASSWORD=your_password"      >> .env

# 3. Generate + run
node generate.js bridge/test-cases/your-app.md
npx playwright test --project=chromium
```

### Day 4 — Wire up corporate n8n

Import the bridge workflows into your corporate n8n:
```bash
N8N_API_KEY=<key-from-n8n-ui> bash bridge/n8n/setup.sh
```

Then from your Windows browser, open n8n and run workflows manually or via Zephyr webhooks.

---

## Test case .md format

`bridge/test-cases/my-app.md`:
```markdown
# My App

## Login
testId: QA-MYAPP-01
url: https://myapp.com/login
credentials: MY_APP
description: Main login form with username and password

## Dashboard
testId: QA-MYAPP-02
url: https://myapp.com/dashboard
description: Post-login landing page
```

Fields:
| Field | Required | Description |
|-------|----------|-------------|
| `testId` | No | Auto-generated if missing (`QA-AUTO-01`) |
| `url` | Yes | Page to snapshot |
| `credentials` | No | Env prefix — maps to `<PREFIX>_USERNAME` / `<PREFIX>_PASSWORD` |
| `description` | No | Passed to Claude for context |

---

## Credentials

Never hardcoded. Always in `.env`:

```bash
# Pattern: <APP_PREFIX>_USERNAME / <APP_PREFIX>_PASSWORD
THE_INTERNET_USERNAME=tomsmith
THE_INTERNET_PASSWORD=SuperSecretPassword!
MY_APP_USERNAME=qa@mycompany.com
MY_APP_PASSWORD=your_password
```

In specs, accessed via:
```typescript
import { appCredentials } from '../../utils/env';
const { username, password } = appCredentials('MY_APP');
```

---

## Bridge API endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/health` | None | Service + browser status |
| POST | `/snapshot` | `x-api-key` | DOM snapshot + locators |
| POST | `/heal` | `x-api-key` | Fix a broken locator |
| POST | `/generate-spec` | `x-api-key` | Snapshot → Claude → `.spec.ts` |
| POST | `/write-spec` | `x-api-key` | Write spec to disk (for n8n LLM node flow) |

All endpoints except `/health` require header: `x-api-key: <BRIDGE_API_KEY>`

---

## n8n workflows

| Workflow | Trigger | What it does |
|----------|---------|--------------|
| **Snapshot** | Webhook `POST /webhook/bridge-snapshot` | Takes a live DOM snapshot |
| **Heal** | Webhook `POST /webhook/bridge-heal` | Suggests a fix for a broken locator |
| **Generate Specs** | Click Run in n8n UI | Reads `.md` → snapshots → Claude → `.spec.ts` |
| **Run Tests** | Click Run in n8n UI | Runs `npx playwright test` on Linux |

### Windows browser workflow (via SSH tunnel)

```powershell
# Keep this running in PowerShell
ssh -L 3000:localhost:3000 -L 5678:localhost:5678 -L 9323:localhost:9323 user@your-linux-box
```

Then in browser:
- **n8n UI**: http://localhost:5678
- **HTML report**: http://localhost:9323
- **Bridge health**: http://localhost:3000/health

---

## Reports

| Reporter | Output | Use |
|----------|--------|-----|
| `list` | Console | Real-time feedback |
| `html` | `playwright-report/` | Full step-by-step with screenshots/video |
| `junit` | `test-results/junit.xml` | CI integration (Jenkins, GitHub Actions) |

```bash
npx playwright show-report        # open locally
# or via SSH tunnel: http://localhost:9323
```

---

## Git workflow

```bash
# After making changes on Linux
git add .
git commit -m "describe your change"
git push

# Pull latest
git pull
cd bridge && npm run build   # only if bridge/ source changed
pm2 restart bridge
```
