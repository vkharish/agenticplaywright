#!/usr/bin/env node
/**
 * generate.js — standalone spec generator (no bridge, no n8n, no Docker)
 *
 * Reads a test-cases .md file, launches Playwright directly, takes a live
 * DOM snapshot for each URL, calls Claude, and writes .spec.ts files into
 * tests/zephyr/.
 *
 * Usage:
 *   node generate.js [path/to/test-cases.md]
 *
 * Requires in .env (or exported in shell):
 *   ANTHROPIC_API_KEY=sk-ant-...
 *
 * Optional:
 *   CLAUDE_MODEL=claude-sonnet-4-6   (default: claude-opus-4-6)
 *   SPECS_OUT_DIR=tests/zephyr
 */

require("dotenv").config({ path: require("path").join(__dirname, ".env") });
require("dotenv").config({ path: require("path").join(__dirname, "bridge", ".env") });

const fs   = require("fs");
const path = require("path");

const SCRIPT_DIR = __dirname;
const SPECS_OUT  = path.resolve(process.env.SPECS_OUT_DIR ?? path.join(SCRIPT_DIR, "tests", "zephyr"));
const SNAP_OUT   = path.join(SCRIPT_DIR, "bridge", "snapshots");
const MD_FILE    = path.resolve(process.argv[2] ?? path.join(SCRIPT_DIR, "bridge", "test-cases", "the-internet.md"));

// ── interactive roles worth surfacing as locator suggestions ─────────────────
const INTERACTIVE_ROLES = new Set([
  "button", "link", "textbox", "combobox", "checkbox", "radio",
  "menuitem", "tab", "switch", "searchbox", "spinbutton",
  "listbox", "option", "menuitemcheckbox", "menuitemradio",
]);

// ── parse ariaSnapshot string → getByRole() suggestions ─────────────────────
function extractLocators(snapshot) {
  const results = [];
  const lineRe  = /^[\s-]*(\w[\w-]*)\s+"([^"]+)"/;

  for (const raw of snapshot.split("\n")) {
    const m = raw.match(lineRe);
    if (!m) continue;
    const role = m[1].toLowerCase();
    const name = m[2];
    if (!INTERACTIVE_ROLES.has(role)) continue;

    const trimmed   = name.trim();
    const needsRegex = name !== trimmed || /[A-Z]/.test(name);
    const nameArg   = needsRegex
      ? `/${trimmed.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/i`
      : `'${trimmed}'`;

    results.push({
      element  : `${role.charAt(0).toUpperCase() + role.slice(1)} "${trimmed}"`,
      locator  : `page.getByRole('${role}', { name: ${nameArg} })`,
      priority : ["button", "textbox", "link", "combobox"].includes(role) ? 1 : 2,
    });
  }
  return results;
}

// ── execute flow steps before snapshotting ───────────────────────────────────
async function executeSteps(page, steps, credentials) {
  for (const raw of steps) {
    const step = raw.trim();

    if (step === "login") {
      if (!credentials) throw new Error("Step 'login' requires credentials but none provided. Set credentials: in your .md file.");
      await page.getByRole("textbox", { name: /username|email|user/i }).fill(credentials.username);
      await page.getByRole("textbox", { name: /password/i }).fill(credentials.password);
      await page.getByRole("button", { name: /log.?in|sign.?in|submit/i }).click();
      await page.waitForLoadState("domcontentloaded");
      continue;
    }

    if (step.startsWith("click:")) {
      const text   = step.slice("click:".length).trim();
      const nameRe = new RegExp(text, "i");
      const roles  = ["button", "link", "tab", "menuitem", "option"];
      let clicked  = false;
      for (const role of roles) {
        const loc = page.getByRole(role, { name: nameRe });
        if (await loc.count() > 0) { await loc.first().click(); clicked = true; break; }
      }
      if (!clicked) await page.getByText(text, { exact: false }).first().click();
      await page.waitForLoadState("domcontentloaded");
      continue;
    }

    if (step.startsWith("navigate:")) {
      await page.goto(step.slice("navigate:".length).trim(), { waitUntil: "domcontentloaded" });
      continue;
    }

    if (step.startsWith("fill:")) {
      const rest = step.slice("fill:".length).trim();
      const pipe = rest.indexOf("|");
      if (pipe === -1) throw new Error(`'fill:' needs 'fill: <label> | <value>'. Got: ${step}`);
      await page.getByRole("textbox", { name: new RegExp(rest.slice(0, pipe).trim(), "i") })
                .fill(rest.slice(pipe + 1).trim());
      continue;
    }

    if (step === "wait") { await page.waitForLoadState("networkidle"); continue; }

    if (step.startsWith("wait:")) {
      const ms = parseInt(step.slice("wait:".length).trim(), 10);
      if (isNaN(ms)) throw new Error(`'wait:<ms>' expects a number. Got: ${step}`);
      await page.waitForTimeout(ms);
      continue;
    }

    throw new Error(`Unknown step: "${step}". Supported: login | click:<text> | navigate:<url> | fill:<label>|<value> | wait | wait:<ms>`);
  }
}

// ── take a DOM snapshot with Playwright ─────────────────────────────────────
async function snapshot(page, url, { steps = [], credentials } = {}) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });

  if (steps.length > 0) {
    await executeSteps(page, steps, credentials);
  }

  await page.waitForTimeout(500);
  const title             = await page.title();
  const finalUrl          = page.url();
  const accessibilityTree = await page.locator("body").ariaSnapshot();
  const suggestedLocators = extractLocators(accessibilityTree);
  return { title, finalUrl, accessibilityTree, suggestedLocators };
}

// ── call Claude to generate a .spec.ts ───────────────────────────────────────
async function generateSpec({ testId, suiteName, description, url, credentialsPrefix, accessibilityTree, suggestedLocators }) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set.\n" +
      "  Add it to .env or bridge/.env:\n" +
      "  ANTHROPIC_API_KEY=sk-ant-..."
    );
  }

  const client = new Anthropic({ apiKey });

  const locatorLines = suggestedLocators
    .map(l => `  ${l.element}  →  ${l.locator}`)
    .join("\n");

  const credentialBlock = credentialsPrefix
    ? `
## Credentials (NEVER hardcode — always read from env)
This test requires a username and password. Use this exact pattern:

\`\`\`typescript
import { appCredentials } from '../../utils/env';
const { username, password } = appCredentials('${credentialsPrefix}');
\`\`\`

The values come from .env:
  ${credentialsPrefix}_USERNAME=<the actual username>
  ${credentialsPrefix}_PASSWORD=<the actual password>

Use the \`username\` and \`password\` variables in the test steps — never paste the real values.`
    : `
## Credentials
This page does not require login credentials. Do not import or reference any credential utilities.`;

  const prompt = `You are a Playwright test automation engineer. Generate a complete .spec.ts file.

## Project conventions (follow exactly)

- Import: \`import { test, expect } from '@playwright/test';\`
- Import: \`import { zephyrStep, zephyrExpected } from '../../utils/zephyr';\`
- Do NOT import Page Object classes — write all locators inline using the list below
- Use ONLY \`getByRole()\` locators from the provided list — never CSS or XPath
- Wrap every action in \`await zephyrStep(n, 'description', async () => { ... })\`
- Wrap every assertion in \`await zephyrExpected(n, 'description', async () => { ... })\`
- Use web-first assertions: toBeVisible(), toHaveValue(), toContainText(), toHaveURL()
- Generate 3–5 meaningful steps covering the main user journey on this page
- Output ONLY valid TypeScript — no markdown fences, no explanation

## Header format (use this exactly, fill in the blanks)

/**
 * ════════════════════════════════════════════════════════════════════════════════
 * Zephyr Test ID : ${testId}
 * Suite          : ${suiteName}
 * Target URL     : ${url}
 *
 * Locators sourced from live ariaSnapshot via generate.js.
 * ════════════════════════════════════════════════════════════════════════════════
 *
 * Zephyr Steps:
 *   Step 1 — [your step]
 *             Expected: [your expected]
 *   ...
 */

## Test metadata
- Test ID   : ${testId}
- Suite     : ${suiteName}
- Description: ${description}
- URL       : ${url}
${credentialBlock}

## Live accessibility tree (from Playwright ariaSnapshot)
${accessibilityTree}

## Available locators — use ONLY these
${locatorLines}

Generate the complete spec file now:`;

  const model    = process.env.CLAUDE_MODEL ?? "claude-opus-4-6";
  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });

  const block = response.content[0];
  if (block.type !== "text") throw new Error("Unexpected Claude response type");

  return block.text
    .replace(/^```(?:typescript|ts)?\n?/, "")
    .replace(/\n?```$/, "")
    .trim();
}

// ── parse .md ─────────────────────────────────────────────────────────────────
// Recognised fields inside a ## section:
//   testId:      optional — auto-generated if missing
//   url:         required
//   description: optional
//   credentials: optional — maps to <PREFIX>_USERNAME / <PREFIX>_PASSWORD in .env
//   steps:       optional multi-line block — each '  - step' line is one step
function parseMd(filePath) {
  const lines   = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  const cases   = [];
  let cur       = null;
  let autoIdx   = 1;
  let inSteps   = false;

  const flush = () => {
    if (cur?.url) {
      if (!cur.testId) cur.testId = `QA-AUTO-${String(autoIdx++).padStart(2, "0")}`;
      cases.push(cur);
    }
  };

  for (const line of lines) {
    const heading    = line.match(/^##\s+(.+)/);
    const testIdLine = line.match(/^testId:\s+(.+)/);
    const urlLine    = line.match(/^url:\s+(.+)/);
    const descLine   = line.match(/^description:\s+(.+)/);
    const credLine   = line.match(/^credentials:\s+(.+)/);
    const stepsLine  = line.match(/^steps:\s*$/);
    const stepItem   = line.match(/^\s+-\s+(.+)/);

    if (heading) {
      flush();
      cur = { name: heading[1].trim(), testId: "", url: "", description: "", credentialsPrefix: "", steps: [] };
      inSteps = false;
    } else if (cur) {
      if (inSteps) {
        if (stepItem) cur.steps.push(stepItem[1].trim());
        // blank lines inside steps block are silently skipped
      } else {
        if (stepsLine)       inSteps = true;
        else if (testIdLine) cur.testId            = testIdLine[1].trim();
        else if (urlLine)    cur.url               = urlLine[1].trim();
        else if (descLine)   cur.description       = descLine[1].trim();
        else if (credLine)   cur.credentialsPrefix = credLine[1].trim();
      }
    }
  }
  flush();
  return cases;
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  if (!fs.existsSync(MD_FILE)) {
    console.error(`File not found: ${MD_FILE}`);
    process.exit(1);
  }

  const cases = parseMd(MD_FILE);
  if (cases.length === 0) {
    console.error("No test cases (url: lines) found in", MD_FILE);
    process.exit(1);
  }

  fs.mkdirSync(SPECS_OUT, { recursive: true });
  fs.mkdirSync(SNAP_OUT,  { recursive: true });

  // Launch browser once, reuse across all test cases
  const { chromium } = require("playwright");
  const browser = await chromium.launch({ headless: true });

  console.log(`\nFound ${cases.length} test case(s) in ${MD_FILE}\n`);

  let passed = 0, failed = 0;

  for (let i = 0; i < cases.length; i++) {
    const { testId, name, url, description, credentialsPrefix, steps } = cases[i];
    console.log(`  [${i + 1}/${cases.length}] ${testId} — ${name}`);
    console.log(`         ${description || ""}`);
    if (steps.length > 0) console.log(`         Steps: ${steps.join(" → ")}`);

    // Resolve form credentials from env (used by 'login' step)
    let credentials;
    if (credentialsPrefix) {
      const username = process.env[`${credentialsPrefix}_USERNAME`];
      const password = process.env[`${credentialsPrefix}_PASSWORD`];
      if (username && password) credentials = { username, password };
    }

    const context = await browser.newContext();
    const page    = await context.newPage();

    try {
      // 1. Snapshot (with optional flow steps)
      process.stdout.write(`         Snapshot …`);
      const snap     = await snapshot(page, url, { steps, credentials });
      const snapFile = path.join(SNAP_OUT, `${testId}.json`);
      fs.writeFileSync(snapFile, JSON.stringify({ ...snap, testCase: { testId, name, description } }, null, 2));
      process.stdout.write(` ✓   Generate spec …`);

      // 2. Call Claude
      const spec     = await generateSpec({ testId, suiteName: name, description, url: snap.finalUrl, credentialsPrefix: credentialsPrefix || undefined, accessibilityTree: snap.accessibilityTree, suggestedLocators: snap.suggestedLocators });
      const specFile = path.join(SPECS_OUT, `${testId}.spec.ts`);
      fs.writeFileSync(specFile, spec, "utf8");

      console.log(` ✓`);
      console.log(`         → bridge/snapshots/${path.basename(snapFile)}`);
      console.log(`         → tests/zephyr/${path.basename(specFile)}`);
      passed++;
    } catch (err) {
      console.log(` ✗  ${err.message}`);
      failed++;
    } finally {
      await page.close();
      await context.close();
    }
    console.log();
  }

  await browser.close();
  console.log(`Done: ${passed} passed, ${failed} failed.`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
