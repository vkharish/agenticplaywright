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

- **Self-healing CI** — when a test fails, the framework suggests a fix. QA reviews and approves. No more test debt accumulating silently.
- **No knowledge lock-in** — specs are plain TypeScript. Any developer or QA can read, modify, and understand them. AI is only involved at generation time.
- **No vendor lock-in** — built on Playwright (Microsoft, open source), standard TypeScript, and the Anthropic API. Each layer is independently replaceable.
- **Credentials never exposed** — all usernames and passwords live in `.env` files, never in code, never committed to Git.

---

## Roadmap & Strategic Value

| Phase | What it delivers | Status |
|-------|-----------------|--------|
| **Phase 1** (now) | Generate tests from `.md` file, run on Linux, view HTML report from Windows browser | ✅ Working |
| **Phase 2** (next) | Connect corporate n8n — trigger generation from Windows browser, no terminal needed | 🔄 In progress |
| **Phase 3** | Zephyr webhook → test auto-generated when QA creates a test case in Jira | Planned |
| **Phase 4** | CI self-healing — broken test in Jenkins/GitHub Actions → AI suggests fix → auto PR | Planned |

**Phase 3 impact:** When a tester creates a test case in Zephyr, the test is automatically generated, committed, and queued to run — with zero manual steps. Coverage keeps pace with the sprint.

---

## One-line Pitch

> *"We reduced the time to write and maintain a Playwright test from 4 hours to 3 minutes — using AI to read the live UI and generate production-ready test code, with no vendor lock-in and no disruption to the existing Jira/Zephyr workflow."*

---

## Technical Proof Points (for engineering leadership)

- Framework has been tested end-to-end on a public test site — **4/4 tests pass**
- Generated locators use `getByRole()` (WCAG-aligned, refactor-resistant)
- Runs headless on Linux, report viewable from Windows via SSH tunnel — **no special tooling needed on the Windows laptop**
- All credentials managed via `.env` — **nothing sensitive in source control**
- Built on tools the team already knows: Playwright, TypeScript, Node.js
