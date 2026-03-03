#!/usr/bin/env node
/**
 * heal-on-failure.js
 *
 * Called by Jenkins after a Playwright test run when tests fail.
 * Reads test-results/junit.xml, finds each failed test, extracts the
 * broken locator and URL, calls bridge /heal, and prints suggested fixes.
 *
 * Usage:
 *   node scripts/heal-on-failure.js
 *
 * Env vars:
 *   BRIDGE_URL      default: http://localhost:3000
 *   BRIDGE_API_KEY  default: dev-key
 *   JUNIT_XML       default: test-results/junit.xml
 */

require("dotenv").config();

const fs   = require("fs");
const path = require("path");

const BRIDGE_URL  = process.env.BRIDGE_URL    ?? "http://localhost:3000";
const API_KEY     = process.env.BRIDGE_API_KEY ?? "dev-key";
const JUNIT_FILE  = process.env.JUNIT_XML      ?? path.join(__dirname, "..", "test-results", "junit.xml");
const SPECS_DIR   = path.join(__dirname, "..", "tests", "zephyr");

// ── helpers ───────────────────────────────────────────────────────────────────

async function callHeal(url, brokenLocator, errorMessage, context) {
  const res = await fetch(`${BRIDGE_URL}/heal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": API_KEY },
    body: JSON.stringify({ url, brokenLocator, errorMessage, context }),
  });
  return res.json();
}

// Extract the broken locator from Playwright's error output.
// Playwright includes the locator in the error like:
//   waiting for page.getByRole('button', { name: 'Sign in' })
// or:
//   locator.click: page.getByRole('button', { name: 'Sign in' })
function extractBrokenLocator(failureText) {
  const patterns = [
    /waiting for (page\.getBy\w+\([^)]+\)(?:,\s*\{[^}]+\})?)/,
    /locator\.\w+:\s*(page\.getBy\w+\([^)]+\)(?:,\s*\{[^}]+\})?)/,
    /(page\.getBy\w+\(['"]\w+['"],\s*\{[^}]+\}))/,
    /(page\.getBy\w+\([^)]+\))/,
  ];
  for (const re of patterns) {
    const m = failureText.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// Extract Target URL from the spec file header comment.
// Looks for:  * Target URL     : https://...
function extractUrlFromSpec(specFile) {
  if (!fs.existsSync(specFile)) return null;
  const content = fs.readFileSync(specFile, "utf8");
  const m = content.match(/Target URL\s*:\s*(https?:\/\/\S+)/);
  return m ? m[1].trim() : null;
}

// Parse failed testcases from JUnit XML using simple regex.
// Returns: [{ testName, specFile, failureText }]
function parseFailures(xmlContent) {
  const failures = [];
  // Match each <testcase> block
  const testcaseRe = /<testcase([^>]*)>([\s\S]*?)<\/testcase>/g;
  let tc;
  while ((tc = testcaseRe.exec(xmlContent)) !== null) {
    const attrs    = tc[1];
    const body     = tc[2];
    if (!body.includes("<failure")) continue;

    // classname contains the spec file path e.g. tests/zephyr/QA-INTERNET-01.spec.ts
    const classMatch = attrs.match(/classname="([^"]+)"/);
    const nameMatch  = attrs.match(/\bname="([^"]+)"/);
    const failMatch  = body.match(/<failure[^>]*>([\s\S]*?)<\/failure>/);

    if (!classMatch || !failMatch) continue;

    const specFile   = path.join(__dirname, "..", classMatch[1]);
    const testName   = nameMatch ? nameMatch[1] : classMatch[1];
    const failureText = failMatch[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

    failures.push({ testName, specFile, failureText });
  }
  return failures;
}

// ── main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(JUNIT_FILE)) {
    console.log(`No JUnit XML found at ${JUNIT_FILE} — nothing to heal.`);
    process.exit(0);
  }

  const xml      = fs.readFileSync(JUNIT_FILE, "utf8");
  const failures = parseFailures(xml);

  if (failures.length === 0) {
    console.log("No test failures found in JUnit XML.");
    process.exit(0);
  }

  // Verify bridge is up
  try {
    const h = await fetch(`${BRIDGE_URL}/health`);
    if (!h.ok) throw new Error(`HTTP ${h.status}`);
  } catch {
    console.error(`Bridge not reachable at ${BRIDGE_URL} — cannot auto-heal.`);
    console.error(`Start the bridge first: pm2 start npm --name bridge -- start`);
    process.exit(1);
  }

  console.log(`\n🔧 Auto-heal: found ${failures.length} failed test(s)\n`);
  console.log("=".repeat(70));

  const results = [];

  for (const { testName, specFile, failureText } of failures) {
    console.log(`\nTest    : ${testName}`);
    console.log(`Spec    : ${specFile}`);

    const url            = extractUrlFromSpec(specFile);
    const brokenLocator  = extractBrokenLocator(failureText);

    if (!url) {
      console.log(`⚠  Could not extract URL from spec header — skipping.`);
      console.log(`   Add "Target URL : https://..." to the spec file header.`);
      results.push({ testName, status: "skipped", reason: "no URL in spec header" });
      continue;
    }

    if (!brokenLocator) {
      console.log(`⚠  Could not extract broken locator from error — skipping.`);
      console.log(`   Error snippet: ${failureText.slice(0, 200)}`);
      results.push({ testName, status: "skipped", reason: "no locator in error output" });
      continue;
    }

    console.log(`URL     : ${url}`);
    console.log(`Broken  : ${brokenLocator}`);
    process.stdout.write(`Healing …`);

    try {
      const heal = await callHeal(url, brokenLocator, failureText.slice(0, 500), testName);

      if (!heal.success) {
        console.log(` ✗  ${heal.error}`);
        results.push({ testName, status: "error", reason: heal.error });
        continue;
      }

      console.log(` ✓`);
      console.log(`Fix     : ${heal.suggestedFix}`);
      console.log(`Reason  : ${heal.explanation}`);
      console.log(`Trust   : ${heal.confidence.toUpperCase()}`);
      results.push({
        testName,
        status       : "healed",
        brokenLocator,
        suggestedFix : heal.suggestedFix,
        explanation  : heal.explanation,
        confidence   : heal.confidence,
        url,
      });
    } catch (err) {
      console.log(` ✗  ${err.message}`);
      results.push({ testName, status: "error", reason: err.message });
    }
  }

  // Write heal results to file for Jenkins to archive
  const outFile = path.join(__dirname, "..", "test-results", "heal-suggestions.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

  console.log("\n" + "=".repeat(70));
  const healed  = results.filter(r => r.status === "healed").length;
  const skipped = results.filter(r => r.status === "skipped").length;
  const errored = results.filter(r => r.status === "error").length;
  console.log(`\nSummary: ${healed} healed, ${skipped} skipped, ${errored} errors`);
  console.log(`Results saved to: test-results/heal-suggestions.json`);
  console.log(`\nNext step: review suggestions above and update the broken locators in your spec files.`);
}

main().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
