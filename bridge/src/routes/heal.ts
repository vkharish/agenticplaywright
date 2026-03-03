import { Router, Request, Response } from "express";
import { z } from "zod";
import { newSession, closeSession } from "../services/browser";
import { requireApiKey } from "../middleware/apiKey";
import { extractLocatorsFromSnapshot, LocatorSuggestion } from "../utils/aria";

const router = Router();

const HealSchema = z.object({
  url: z.string().url(),
  brokenLocator: z.string(),
  errorMessage: z.string(),
  context: z.string().optional(),
  auth: z
    .object({ username: z.string(), password: z.string() })
    .optional(),
});

router.post("/heal", requireApiKey, async (req: Request, res: Response) => {
  const parsed = HealSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { url, brokenLocator, errorMessage, context, auth } = parsed.data;
  const session = await newSession(auth);

  try {
    await session.page.goto(url, { waitUntil: "domcontentloaded" });

    const freshAccessibilityTree = await session.page.locator("body").ariaSnapshot();
    const candidates = extractLocatorsFromSnapshot(freshAccessibilityTree);

    const { suggestedFix, explanation, confidence } = pickBestFix(
      brokenLocator,
      errorMessage,
      context ?? "",
      candidates
    );

    res.json({
      success: true,
      brokenLocator,
      suggestedFix,
      explanation,
      freshAccessibilityTree,
      confidence,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  } finally {
    await closeSession(session);
  }
});

// ---------------------------------------------------------------------------
// Heuristic matcher: finds the best candidate from fresh locators
// ---------------------------------------------------------------------------
function pickBestFix(
  brokenLocator: string,
  _errorMessage: string,
  context: string,
  candidates: LocatorSuggestion[]
): { suggestedFix: string; explanation: string; confidence: "high" | "medium" | "low" } {
  if (candidates.length === 0) {
    return {
      suggestedFix: brokenLocator,
      explanation: "No interactive elements found on the page.",
      confidence: "low",
    };
  }

  // Extract the role and name from brokenLocator: getByRole('button', { name: 'Sign in' })
  const roleMatch = brokenLocator.match(/getByRole\(['"]([\w-]+)['"]/);
  const nameMatch = brokenLocator.match(/name:\s*['"`]([^'"`]+)['"`]/);
  const brokenRole = roleMatch?.[1] ?? "";
  const brokenName = nameMatch?.[1] ?? "";

  // Prefer same-role candidates, fall back to all candidates
  const sameRole = candidates.filter((c) =>
    c.locator.includes(`getByRole('${brokenRole}'`)
  );
  const pool = sameRole.length > 0 ? sameRole : candidates;

  const contextWords = (context + " " + brokenName)
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);

  let best = pool[0];
  let bestScore = -1;

  for (const candidate of pool) {
    const label = candidate.element.toLowerCase();
    const score = contextWords.filter((w) => label.includes(w)).length;
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  const confidence: "high" | "medium" | "low" =
    bestScore >= 2 ? "high" : bestScore === 1 ? "medium" : "low";

  const explanation =
    brokenName && best.element.toLowerCase() !== brokenName.toLowerCase()
      ? `Element label changed from "${brokenName}" to "${best.element}". Updated locator targets the current DOM.`
      : `Matched "${best.element}" as the closest interactive element to the broken locator.`;

  return { suggestedFix: best.locator, explanation, confidence };
}

export default router;
