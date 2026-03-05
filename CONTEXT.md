# Claude Context Document — Agentic Playwright Framework

This document is for Claude to understand the full project so work can continue
seamlessly across sessions. Read this before touching any code.

---

## What this project is

An AI-driven Playwright test framework that:
1. Reads a `.md` file describing pages to test
2. Uses Playwright to take a live DOM snapshot of each page (accessibility tree + locators)
3. Sends the snapshot to Claude API → Claude writes a ready-to-run `.spec.ts` file
4. The spec is saved to `tests/zephyr/` and run with `npx playwright test`

No mocks. No hardcoded selectors. Tests are generated from the live DOM every time.

---

## Repository

`git@github.com:vkharish/agenticplaywright.git`

**Primary machine: Windows laptop** (office)
- Node.js already installed (corporate)
- Git already installed (corporate GitLab setup)
- Cloned to `%USERPROFILE%\anthropic` (i.e. `C:\Users\YourName\anthropic`)

**Secondary: Linux box** (optional, for server-side runs or Jenkins)
- Cloned to `~/anthropic`

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| Test runner | Playwright (TypeScript) |
| Spec generator (standalone) | `generate.js` — Node.js + Playwright + Anthropic SDK |
| Spec generator (via HTTP) | `bridge/` — Express microservice |
| AI | Claude API (`claude-opus-4-6` default, `claude-sonnet-4-6` optional) |
| Orchestration | n8n (corporate instance, separate Linux box) |
| CI | Jenkins (corporate) |
| Credentials | `.env` files — never committed |

---

## Architecture

```
Windows laptop (primary)
├── bridge/          Express HTTP microservice (port 3000) — PowerShell window
├── Playwright       Runs tests directly on Windows — no Docker, no Linux needed
├── generate.js      Generates specs — runs directly in PowerShell
└── Browser          Accesses n8n UI, Jira, Jenkins, app under test directly

Corporate network (already accessible from Windows)
├── n8n              Corporate hosted instance — reachable from Windows browser
├── Jira/Zephyr      Test case management
└── Jenkins          CI pipeline

Linux box (optional — for server-side or headless CI runs)
└── Same repo, same setup — use setup-linux.sh
```

**No Docker needed on Windows.** No SSH tunnels needed — everything is reachable directly.
**No admin rights needed on Windows** — Node.js and Git are already installed corporately.

---

## Three ways to generate specs (understand all three)

### Option A — `generate.js` standalone (simplest, no bridge needed)

```bash
node generate.js bridge/test-cases/the-internet.md
```

Flow: `.md file` → Playwright (direct) → Claude API → `.spec.ts`

Use when: getting started, no n8n, testing locally.

**Default behaviour — skips existing specs automatically.**
Only generates specs for test cases that don't already have a `.spec.ts` in `tests/zephyr/`.
No flag needed — just run it. New test cases in the `.md` file get picked up automatically.

```bash
# Deliberately regenerate everything (e.g. after a major page redesign)
node generate.js bridge/test-cases/the-internet.md --force
```

### Option B — Bridge + `run-from-md.js`

```bash
# Bridge must be running first
node bridge/run-from-md.js bridge/test-cases/the-internet.md
```

Flow: `.md file` → HTTP → `bridge /snapshot` → `bridge /generate-spec` → `.spec.ts`

Use when: n8n is wired up, or wanting persistent browser singleton.

Same skip-existing default applies. Use `--force` to regenerate all.

Also supports snapshot-only mode (no Claude API needed):
```bash
node bridge/run-from-md.js bridge/test-cases/the-internet.md --snapshot-only
```

### Option C — Corporate n8n LLM node (no API key on Linux box)

n8n workflow: `bridge /snapshot` → LLM Node (corporate Claude) → `bridge /write-spec`

Use when: corporate n8n has Claude access built in and API key is not user-accessible.

---

## Directory structure (every important file)

```
~/anthropic/
│
├── generate.js                  ← STANDALONE script. Playwright + Claude, no bridge.
├── setup-linux.sh               ← One-shot Linux setup. Run once on a fresh box.
├── playwright.config.ts         ← Multi-project Playwright config (see projects below)
├── .env                         ← NOT committed. Copy from .env.example. App credentials here.
├── .env.example                 ← Template. Committed.
│
├── tests/
│   └── zephyr/
│       ├── QA-INTERNET-01.spec.ts   Login & Logout (hand-authored)
│       ├── QA-INTERNET-02.spec.ts   Checkboxes (hand-authored)
│       ├── QA-INTERNET-03.spec.ts   Dropdown (hand-authored)
│       ├── QA-INTERNET-04.spec.ts   Invalid credentials error path (hand-authored)
│       └── QA-TEMPLATE.spec.ts      Template for new specs
│
├── pages/                       ← Page Object Models
│   ├── BasePage.ts              ← navigate(), waitForLoad()
│   ├── LoginPage.ts             ← usernameInput, passwordInput, loginButton, login()
│   ├── CheckboxesPage.ts        ← checkboxes, assertStates()
│   └── DropdownPage.ts          ← heading, dropdown, pickOption(), assertSelectedValue()
│
├── utils/
│   ├── env.ts                   ← requireEnv(), optionalEnv(), appCredentials(prefix)
│   └── zephyr.ts                ← zephyrStep(n, desc, fn), zephyrExpected(n, desc, fn)
│
└── bridge/                      ← Express microservice
    ├── src/
    │   ├── index.ts             ← Entry point. Loads dotenv, registers all routers.
    │   ├── routes/
    │   │   ├── health.ts        ← GET  /health → { status, browser }
    │   │   ├── snapshot.ts      ← POST /snapshot → { accessibilityTree, suggestedLocators, ... }
    │   │   ├── heal.ts          ← POST /heal → { suggestedFix, explanation, confidence }
    │   │   ├── generate.ts      ← POST /generate-spec → { spec } (needs ANTHROPIC_API_KEY)
    │   │   └── writeSpec.ts     ← POST /write-spec → writes testId.spec.ts to tests/zephyr/
    │   ├── services/
    │   │   ├── browser.ts       ← Playwright singleton. getBrowser(), newSession(), closeSession()
    │   │   └── claude.ts        ← Anthropic SDK. generateSpec(params) → spec string
    │   ├── middleware/
    │   │   └── apiKey.ts        ← x-api-key header check against BRIDGE_API_KEY env var
    │   └── utils/
    │       ├── aria.ts          ← extractLocatorsFromSnapshot(ariaYaml) → LocatorSuggestion[]
    │       └── steps.ts         ← executeSteps(page, steps, credentials) — Approach 3 navigator
    ├── test-cases/
    │   ├── the-internet.md      ← Test cases for https://the-internet.herokuapp.com
    │   └── my-app.md            ← Template for your own app — edit this
    ├── snapshots/               ← Saved DOM snapshots (gitignored)
    ├── n8n/
    │   ├── snapshot-workflow.json      ← n8n: Webhook → /snapshot → respond
    │   ├── heal-workflow.json          ← n8n: Webhook → /heal → respond
    │   ├── generate-specs-workflow.json← n8n: Manual → executeCommand(run-from-md.js)
    │   ├── run-tests-workflow.json     ← n8n: Manual → executeCommand(playwright test)
    │   └── setup.sh                    ← Imports all 4 workflows via n8n public API v1
    ├── run-from-md.js           ← Cross-platform. Calls bridge HTTP API. Supports --snapshot-only
    ├── run-from-md.sh           ← Bash version
    ├── package.json             ← Bridge deps: express, playwright, zod, @anthropic-ai/sdk, dotenv
    ├── tsconfig.json
    ├── Dockerfile               ← Not used on Linux. Was for Mac Docker workflow.
    ├── docker-compose.yml       ← Not used on Linux. Was for Mac Docker workflow.
    ├── .env                     ← NOT committed. ANTHROPIC_API_KEY + BRIDGE_API_KEY here.
    └── .env.example             ← Template. Committed.
```

---

## Playwright projects (playwright.config.ts)

| Project | testMatch | Auth | baseURL |
|---------|-----------|------|---------|
| `public-chromium` | `QA-INTERNET-*.spec.ts` | None (login inside test) | `https://the-internet.herokuapp.com` |
| `chromium` | all specs | `auth/storageState.json` | `process.env.BASE_URL` |
| `firefox` | all specs | `auth/storageState.json` | `process.env.BASE_URL` |
| `mobile-chrome` | all specs | `auth/storageState.json` | `process.env.BASE_URL` |
| `setup` | `auth.setup.ts` | Runs first, saves session | — |

For the-internet specs always use `--project=public-chromium`.
For your own app use `--project=chromium`.

---

## Environment variables

### `~/anthropic/.env`

```
BASE_URL=https://your-app.com
TEST_USERNAME=generic_username
TEST_PASSWORD=generic_password
THE_INTERNET_USERNAME=tomsmith
THE_INTERNET_PASSWORD=SuperSecretPassword!
MY_APP_USERNAME=qa@yourcompany.com
MY_APP_PASSWORD=your_password
```

### `~/anthropic/bridge/.env`

```
BRIDGE_API_KEY=dev-key
ANTHROPIC_API_KEY=sk-ant-YOUR-KEY-HERE
PORT=3000
CLAUDE_MODEL=claude-opus-4-6    # optional, this is the default
```

---

## Credentials pattern (important — always follow this)

**In `.env`:** `<APP_PREFIX>_USERNAME` / `<APP_PREFIX>_PASSWORD`

**In `.md` test case file:** `credentials: APP_PREFIX`

**In generated `.spec.ts`:**
```typescript
import { appCredentials } from '../../utils/env';
const { username, password } = appCredentials('APP_PREFIX');
```

Never hardcode credentials. Never use `process.env.THE_INTERNET_USERNAME` directly in specs — always go through `appCredentials()` or `requireEnv()`.

---

## Test case `.md` format

```markdown
# App Name

## Simple Page (no login required)
testId: QA-MYAPP-01
url: https://myapp.com/login
credentials: MY_APP
description: What this page does and what to test

## Page Behind Login (Approach 3 — flow steps)
testId: QA-MYAPP-02
url: https://myapp.com/login
credentials: MY_APP
description: Dashboard — post-login landing page
steps:
  - login
  - click: Reports
  - click: Monthly Summary
```

Fields:
- `testId` — if omitted, auto-generates `QA-AUTO-01`
- `url` — required. For multi-step flows, set this to the START URL (e.g. login page)
- `credentials` — optional. Prefix maps to `<PREFIX>_USERNAME` / `<PREFIX>_PASSWORD` in `.env`
- `description` — optional context passed to Claude
- `steps` — optional multi-line block. Each `  - step` is executed in order BEFORE the snapshot is taken

### Supported step types

| Step | Example | What it does |
|------|---------|-------------|
| `login` | `- login` | Fills username + password from credentials, clicks submit |
| `click: <text>` | `- click: Reports` | Clicks button/link/tab/menuitem matching the text |
| `navigate: <url>` | `- navigate: https://myapp.com/reports` | Hard-navigates to a URL |
| `fill: <label> \| <value>` | `- fill: Search \| invoice 1234` | Fills an input by its label |
| `wait` | `- wait` | Waits for network idle |
| `wait: <ms>` | `- wait: 2000` | Waits N milliseconds |

**How credentials flow to steps:**
- `run-from-md.js` resolves `credentials: MY_APP` → reads `MY_APP_USERNAME` / `MY_APP_PASSWORD` from root `.env` → passes `{ username, password }` in the HTTP body to `bridge /snapshot`
- `generate.js` resolves the same from root `.env` and passes directly to `executeSteps()`
- The bridge's `executeSteps()` (`bridge/src/utils/steps.ts`) uses these to fill the login form
- Credentials are **never** stored in the snapshot or spec — only used during navigation

---

## Bridge API reference

All endpoints except `/health` require header: `x-api-key: <BRIDGE_API_KEY>`

### POST /snapshot
```json
Request: {
  "url": "https://myapp.com/login",
  "steps": ["login", "click: Reports"],        // optional — Approach 3 flow steps
  "credentials": { "username": "u", "password": "p" },  // optional — for 'login' step
  "auth": { "username": "u", "password": "p" }           // optional — HTTP Basic Auth only
}
Response: {
  "success": true,
  "title": "Page Title",
  "finalUrl": "https://myapp.com/reports",     // reflects final URL after steps
  "accessibilityTree": "- heading \"Reports\"...",
  "suggestedLocators": [
    { "element": "Textbox \"Username\"", "locator": "page.getByRole('textbox', { name: /Username/i })", "priority": 1 }
  ],
  "timestamp": "2026-03-03T..."
}
```

**Important:** `auth` is for HTTP Basic Auth (browser prompt). `credentials` is for form-based login used by the `login` step. These are separate fields.

### POST /heal
```json
Request: {
  "url": "https://myapp.com/login",
  "brokenLocator": "page.getByRole('button', { name: 'Sign in' })",
  "errorMessage": "resolved to 0 elements",
  "context": "login submit button"
}
Response: {
  "success": true,
  "suggestedFix": "page.getByRole('button', { name: /Login/i })",
  "explanation": "Button text changed from 'Sign in' to 'Login'",
  "confidence": "high"
}
```

### POST /generate-spec
```json
Request: {
  "testId": "QA-MYAPP-01",
  "suiteName": "Login Page",
  "description": "Main login form",
  "url": "https://myapp.com/login",
  "credentialsPrefix": "MY_APP",
  "accessibilityTree": "...",
  "suggestedLocators": [...]
}
Response: { "success": true, "spec": "import { test... }" }
```

### POST /write-spec
```json
Request:  { "testId": "QA-MYAPP-01", "spec": "import { test... }" }
Response: { "success": true, "testId": "QA-MYAPP-01", "filePath": "...tests/zephyr/QA-MYAPP-01.spec.ts" }
```

---

## Spec conventions (Claude must follow these when generating)

1. **Imports** — always `import { test, expect } from '@playwright/test'`
2. **Zephyr wrappers** — always `import { zephyrStep, zephyrExpected } from '../../utils/zephyr'`
3. **No Page Objects in generated specs** — write locators inline
4. **Locators** — only `getByRole()`, never CSS or XPath
5. **Actions** — always wrapped in `await zephyrStep(n, 'description', async () => { ... })`
6. **Assertions** — always wrapped in `await zephyrExpected(n, 'description', async () => { ... })`
7. **Assertions use** — `toBeVisible()`, `toHaveValue()`, `toContainText()`, `toHaveURL()`
8. **Credentials** — always via `appCredentials()`, never hardcoded
9. **Spec header** — always the full comment block with Test ID, Suite, URL, Steps

---

## Playwright ariaSnapshot — critical implementation note

`page.accessibility.snapshot()` was **removed in Playwright 1.58**.

Use this instead:
```typescript
const ariaYaml = await page.locator('body').ariaSnapshot();
```

Returns a YAML-like string. Example output:
```
- heading "Login Page" [level=2]
- textbox "Username"
- textbox "Password"
- button " Login"
```

This is parsed by `bridge/src/utils/aria.ts` → `extractLocatorsFromSnapshot()`.

---

## n8n integration notes

**Corporate n8n** is on a separate Linux box, reachable from Windows browser.
User does NOT have access to the underlying API keys in corporate n8n — they use the LLM node which has Claude access built in.

**n8n API version:** Public API v1 at `/api/v1/workflows` with `X-N8N-API-KEY` header.
Do NOT use `/rest/login` — it's unstable.

**n8n HTTP Request node (v4.2) gotcha:**
Use `contentType: "raw"` + `rawContentType: "application/json"` for JSON bodies.
`contentType: "json"` sends it as a form key, not a JSON body.

**`active` field is read-only** — remove it from workflow JSON before POST to API.

**Workflow for corporate n8n (Option C):**
```
HTTP Request → POST bridge/snapshot
  ↓ accessibilityTree + suggestedLocators
LLM Node (Claude) → generate spec using the prompt from bridge/src/services/claude.ts
  ↓ spec text
HTTP Request → POST bridge/write-spec { testId, spec }
  ↓
File written to tests/zephyr/{testId}.spec.ts on Linux box
```

---

## Current state (as of last session)

### Working end-to-end ✅ (tested on Mac)
- `generate.js` — tested on the-internet.herokuapp.com, generates specs, runs 4/4 tests
- `bridge/run-from-md.js --snapshot-only` — tested, 4/4 snapshots pass (includes Secure Area with login step)
- **Approach 3 (flow steps) — confirmed working:** Secure Area test navigates through login, snapshots post-login page at `/secure`
- All 4 hand-authored specs pass: QA-INTERNET-01, 02, 03, 04
- Bridge endpoints: /health, /snapshot (with steps), /heal, /generate-spec, /write-spec — all implemented

### Approach 3 implementation — what was built
Multi-page navigation is solved by adding a `steps:` block to the `.md` file. **Do NOT implement Approach 2 (authenticated snapshot / pre-auth cookies).** Approach 3 is already implemented and tested.

Key files added/changed:
- **`bridge/src/utils/steps.ts`** — new. `executeSteps(page, steps, credentials)` — the step runner
- **`bridge/src/routes/snapshot.ts`** — updated. Now accepts `steps[]` + `credentials` in request body
- **`generate.js`** — updated. Parses `steps:` block from `.md`, executes steps inline before snapshot
- **`bridge/run-from-md.js`** — updated. Parses `steps:` block, resolves credentials from root `.env`, sends both to bridge `/snapshot`
- **`bridge/test-cases/the-internet.md`** — updated. Added `QA-INTERNET-06-GEN` Secure Area with `steps: - login`
- **`bridge/test-cases/my-app.md`** — updated. Added QA-MYAPP-02 through 05 with multi-step navigation examples

### Pending ⚠️ (requires ANTHROPIC_API_KEY — test on office Windows laptop)
- Generate spec for `QA-INTERNET-06-GEN` (Secure Area) — snapshot verified ✅, spec generation pending
- `setup-windows.ps1` on the actual office Windows laptop
- `generate.js` full pipeline (snapshot + Claude API) on Windows
- `bridge/run-from-md.js` full pipeline on Windows
- `scripts/heal-on-failure.js` + `Jenkinsfile` in real Jenkins pipeline
- Corporate n8n integration

### Next steps on office Windows laptop
1. Open PowerShell → `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`
2. Clone repo: `git clone git@github.com:vkharish/agenticplaywright.git $env:USERPROFILE\anthropic`
3. Run: `cd $env:USERPROFILE\anthropic && .\setup-windows.ps1`
4. Enter `ANTHROPIC_API_KEY` when prompted
5. Test standalone: `node generate.js bridge/test-cases/the-internet.md`
   - This generates ALL 4 test cases including QA-INTERNET-06-GEN (Secure Area with login step)
6. Run tests: `npx playwright test --project=public-chromium`
7. Add office app to `bridge/test-cases/my-app.md`, fill in real URLs + steps
8. Wire up Jenkins — point job to `Jenkinsfile` in repo, add `BRIDGE_API_KEY` and `APP_BASE_URL` credentials
9. Wire up corporate n8n — build Option C workflow (snapshot → LLM node → write-spec)

### Windows-specific notes for Claude
- Use `%USERPROFILE%\anthropic` or `$env:USERPROFILE\anthropic` for repo path
- `npx playwright install chromium` — no `--with-deps` flag on Windows
- Bridge runs in a PowerShell window with `npm start` — no pm2 needed on Windows
- No `pm2 startup` on Windows — just start manually or use Windows Task Scheduler
- Both `/` and `\` work in Node.js paths on Windows
- `.sh` scripts don't run on Windows — always use the `.js` equivalents (`run-from-md.js` not `run-from-md.sh`)

---

## Jenkins CI + Auto-Heal Integration

### How it works

```
Jenkins runs: npx playwright test
       ↓
Tests fail → junit.xml written to test-results/
       ↓
Jenkins runs: node scripts/heal-on-failure.js
       ↓
Script reads junit.xml → extracts broken locator + URL from each failure
       ↓
Calls bridge POST /heal for each failure
       ↓
Prints suggested fixes in Jenkins build log
Saves test-results/heal-suggestions.json (archived as Jenkins artifact)
```

### Files

| File | Purpose |
|------|---------|
| `Jenkinsfile` | Jenkins pipeline — install, run tests, auto-heal, publish reports |
| `scripts/heal-on-failure.js` | Parses junit.xml, calls /heal, outputs suggestions |

### How heal-on-failure.js extracts the broken locator

Playwright error output always includes the failing locator:
```
waiting for page.getByRole('button', { name: 'Sign in' })
```
The script uses regex to extract it from the `<failure>` block in junit.xml.

### How it finds the URL

Every generated spec file has this in the header comment:
```
 * Target URL     : https://myapp.com/login
```
The script reads the spec file and extracts the URL from that line.
**This is why the Target URL header comment must always be present in spec files.**

### Jenkins setup

1. In Jenkins job → **Pipeline** → point to repo, `Jenkinsfile` path
2. Add these credentials in **Manage Jenkins → Credentials**:
   - `BRIDGE_API_KEY` — same value as in `bridge/.env`
   - `APP_BASE_URL` — your app's base URL
3. The bridge must be running on the Linux box (`pm2 status bridge`)
4. Ensure the Jenkins agent runs on the same Linux box as the bridge (or set `BRIDGE_URL` to the bridge's IP)

### Output

After each failed run, Jenkins archives `test-results/heal-suggestions.json`:
```json
[
  {
    "testName": "QA-MYAPP-01 - Login test",
    "status": "healed",
    "brokenLocator": "page.getByRole('button', { name: 'Sign in' })",
    "suggestedFix": "page.getByRole('button', { name: /Login/i })",
    "explanation": "Button text changed from 'Sign in' to 'Login'",
    "confidence": "high",
    "url": "https://myapp.com/login"
  }
]
```

QA reviews the suggestions, updates the spec file, and re-runs.

---

## Common commands

### Windows (PowerShell) — primary

```powershell
# Start bridge (keep this window open)
cd $env:USERPROFILE\anthropic\bridge
npm start

# Generate specs — standalone (no bridge)
# Automatically skips specs that already exist — only new test cases get generated
cd $env:USERPROFILE\anthropic
node generate.js bridge/test-cases/the-internet.md

# Force regenerate ALL specs (use only after a major page redesign)
node generate.js bridge/test-cases/the-internet.md --force

# Generate specs — via bridge (same skip-existing default applies)
node bridge/run-from-md.js bridge/test-cases/the-internet.md

# Snapshot only (no Claude API needed — useful to test steps/navigation)
node bridge/run-from-md.js bridge/test-cases/the-internet.md --snapshot-only

# Run tests
npx playwright test --project=public-chromium          # for the-internet specs
npx playwright test --project=chromium                 # for your app specs
npx playwright test tests/zephyr/QA-MYAPP-01.spec.ts  # single spec

# View report
npx playwright show-report

# Pull latest and rebuild bridge
git pull
cd bridge && npm run build && cd ..
# restart bridge: close the bridge window and reopen it with npm start

# Auto-heal after failed run
node scripts/heal-on-failure.js

# Bridge health check
Invoke-RestMethod http://localhost:3000/health
```

### Linux (bash) — secondary

```bash
# Bridge via pm2
pm2 start npm --name bridge -- start --prefix ~/anthropic/bridge
pm2 logs bridge
pm2 restart bridge
curl http://localhost:3000/health

# Generate + test
node generate.js bridge/test-cases/the-internet.md
npx playwright test --project=public-chromium
npx playwright show-report

# Pull latest
git pull && cd bridge && npm run build && pm2 restart bridge
```

---

## Things to never do

- Never commit `.env` or `bridge/.env` — they are gitignored
- Never hardcode credentials in spec files
- Never use CSS or XPath locators — only `getByRole()`
- Never use `page.accessibility.snapshot()` — use `page.locator('body').ariaSnapshot()`
- Never add `"active": true/false` when POSTing workflows to n8n API — it's read-only
- Never run `docker compose` on Linux — Docker is not needed there
