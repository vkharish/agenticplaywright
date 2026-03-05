# Agentic Playwright Framework — Management Pitch

---

## The Problem

Traditional test automation has three expensive problems:

1. **Writing tests is slow** — a QA engineer spends 2–4 hours writing a single automated test from scratch
2. **Tests break constantly** — every UI change (button rename, layout shift) breaks locators, requiring manual fixes
3. **Coverage lags behind development** — dev ships features faster than QA can write tests

The result: QA teams spend more time maintaining old tests than covering new features.

---

## What This Framework Does

An AI-driven Playwright test framework that:

- **Reads the live UI** — uses a real browser to capture the accessibility tree of any page
- **Generates tests automatically** — sends the snapshot to Claude, gets back a production-ready test file in seconds
- **Self-heals on failure** — when a CI test breaks, AI suggests the corrected locator automatically

No mocks. No hardcoded selectors. Tests are generated from the live DOM every time.

---

## Side-by-side Comparison

| | Manual approach | This framework |
|--|----------------|----------------|
| DOM inspection + locator writing | 45–90 min | ~10 sec (automated) |
| Writing the test file | 60–120 min | ~30 sec (AI generates) |
| Fixing a broken locator | 30–60 min | ~2 min (AI suggests fix) |
| Adding a new page to coverage | 2–4 hours | ~3 minutes |
| **Total per test case** | **2–4 hours** | **~3 minutes** |

---

## Cost Savings

A mid-level QA engineer costs **£400–600/day** (UK) or **$400–600/day** (US).

For a team maintaining **100 test cases** with monthly UI changes:

| Activity | Manual hours/month | With framework |
|----------|--------------------|----------------|
| Writing new tests | 80–160 hrs | ~5 hrs |
| Fixing broken tests | 50–100 hrs | ~3 hrs |
| **Total** | **130–260 hrs** | **~8 hrs** |

**Saving: 120–250 hours per month** — equivalent to **1–1.5 full-time QA engineers** freed up for exploratory testing, edge cases, and new feature coverage.

**Framework running cost:** Claude API usage is ~$0.01–0.05 per spec generated. For 100 specs, that is under $5 total.

---

## Quality Improvements

- **Consistent test structure** — every generated spec follows the same pattern: Zephyr step IDs, ARIA-based locators, no hardcoded credentials
- **No fragile selectors** — `getByRole()` locators are tied to what the user sees, not internal CSS class names that change with every frontend refactor
- **Accessibility baked in** — tests read the accessibility tree, so they automatically verify that elements are accessible to screen readers
- **Full traceability** — every test maps 1:1 to a Zephyr test case ID; pass/fail results flow directly into Jira

---

## Risk Reduction

- **Jenkins auto-heal** — when a test fails in Jenkins, the pipeline automatically calls the AI to diagnose the broken locator, suggests the fix in the build log, and saves it as a downloadable artifact. QA reviews, updates one line, re-runs. No debugging, no DOM inspection.
- **Zero silent test debt** — failures are never left as "flaky" and ignored. Every failure produces an AI-suggested fix within the same Jenkins build.
- **No accidental regeneration** — the generator automatically skips specs that already exist. Running it twice never overwrites working tests or wastes API calls. A deliberate `--force` flag is required to regenerate.
- **No knowledge lock-in** — specs are plain TypeScript. Any developer or QA can read, modify, and understand them. AI is only involved at generation time.
- **No vendor lock-in** — built on Playwright (Microsoft, open source), standard TypeScript, and the Anthropic API. Each layer is independently replaceable.
- **Credentials never exposed** — all usernames and passwords live in `.env` files, never in code, never committed to Git.

---

## Roadmap & Strategic Value

| Phase | What it delivers | Status |
|-------|-----------------|--------|
| **Phase 1** | Full framework running on Windows — generate tests, run, view report | ✅ Done |
| **Phase 2** | Jenkins CI — run tests automatically, auto-heal broken locators on failure | ✅ Done |
| **Phase 3** | Connect corporate n8n — trigger generation from Windows browser, no terminal needed | 🔄 In progress |
| **Phase 4** | Zephyr webhook → test auto-generated when QA creates a test case in Jira | Planned |

### Jenkins auto-heal — how it works

```
Jenkins runs tests
      ↓
A test fails (e.g. button label changed from "Sign in" to "Login")
      ↓
Jenkins automatically calls AI with the broken locator + live page
      ↓
AI visits the page, reads current DOM, suggests the correct locator
      ↓
Fix printed in Jenkins build log + saved as downloadable artifact
      ↓
QA reviews suggestion, updates one line in the spec, re-runs — done
```

**Before this framework:** QA engineer opens browser, manually inspects DOM, figures out what changed, updates the locator — 30–60 minutes per broken test.

**With this framework:** Jenkins does it automatically. QA just reviews and approves — 2 minutes.

**Phase 4 impact:** When a tester creates a test case in Zephyr, the test is automatically generated, committed, and queued to run — with zero manual steps. Coverage keeps pace with the sprint.

---

## One-line Pitch

> *"We reduced the time to write and maintain a Playwright test from 4 hours to 3 minutes — using AI to read the live UI and generate production-ready test code, with no vendor lock-in and no disruption to the existing Jira/Zephyr workflow."*

---

## Deployment — Zero Infrastructure Overhead

One of the strongest selling points: **this runs entirely on the QA engineer's existing Windows laptop** with no IT involvement.

| Requirement | Detail |
|-------------|--------|
| Admin rights on Windows | ❌ Not needed |
| New server or VM | ❌ Not needed |
| Docker or containers | ❌ Not needed |
| VPN or firewall changes | ❌ Not needed — uses existing corporate network |
| IT ticket to install software | ❌ Not needed — Node.js and Git already installed |
| Special CI agent setup | ❌ Not needed — runs on any Jenkins agent with Node.js |

**Setup time for a new QA engineer: under 10 minutes**
```
1. Open PowerShell
2. git clone ... && .\setup-windows.ps1
3. Enter API key when prompted
4. Done — tests running
```

Everything the QA engineer already uses daily — n8n, Jira, Jenkins, the app under test — is reachable directly from the same Windows browser. No SSH tunnels, no remote desktops, no context switching.

---

## Technical Proof Points (for engineering leadership)

- Framework has been tested end-to-end on a public test site — **4/4 tests pass**
- Runs entirely on **existing Windows laptops** — no new infrastructure needed
- Jenkins pipeline (`Jenkinsfile`) ready to plug into your existing Jenkins instance
- Auto-heal script parses Jenkins JUnit results and calls AI — no manual intervention needed
- Generated locators use `getByRole()` (WCAG-aligned, refactor-resistant)
- All credentials managed via `.env` — **nothing sensitive in source control**
- Built on tools the team already knows: Playwright, TypeScript, Node.js, Jenkins, GitLab
