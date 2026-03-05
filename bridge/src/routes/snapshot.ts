import { Router, Request, Response } from "express";
import { z } from "zod";
import { newSession, closeSession } from "../services/browser";
import { requireApiKey } from "../middleware/apiKey";
import { extractLocatorsFromSnapshot } from "../utils/aria";
import { executeSteps } from "../utils/steps";

const router = Router();

const SnapshotSchema = z.object({
  url: z.string().url(),
  waitFor: z
    .enum(["domcontentloaded", "load", "networkidle", "commit"])
    .optional()
    .default("domcontentloaded"),
  auth: z
    .object({ username: z.string(), password: z.string() })
    .optional(),
  // Form-based credentials used by the 'login' step
  credentials: z
    .object({ username: z.string(), password: z.string() })
    .optional(),
  // Navigation steps to execute before snapshotting (Approach 3)
  steps: z.array(z.string()).optional(),
});

router.post("/snapshot", requireApiKey, async (req: Request, res: Response) => {
  const parsed = SnapshotSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { url, waitFor, auth, steps, credentials } = parsed.data;
  const session = await newSession(auth);

  try {
    await session.page.goto(url, { waitUntil: waitFor });

    if (steps && steps.length > 0) {
      await executeSteps(session.page, steps, credentials);
    }

    await session.page.waitForTimeout(500); // let page settle after navigation/steps

    const title = await session.page.title();
    const finalUrl = session.page.url();

    const accessibilityTree = await session.page.locator("body").ariaSnapshot();
    const suggestedLocators = extractLocatorsFromSnapshot(accessibilityTree);

    res.json({
      success: true,
      title,
      finalUrl,
      accessibilityTree,
      suggestedLocators,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  } finally {
    await closeSession(session);
  }
});

export default router;
