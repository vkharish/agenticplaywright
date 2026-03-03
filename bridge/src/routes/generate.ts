import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { generateSpec } from "../services/claude";

const router = Router();

const GenerateSchema = z.object({
  testId: z.string(),
  suiteName: z.string(),
  description: z.string().optional().default(""),
  credentialsPrefix: z.string().optional(),
  url: z.string().url(),
  accessibilityTree: z.string(),
  suggestedLocators: z.array(
    z.object({
      element: z.string(),
      locator: z.string(),
      priority: z.number(),
    })
  ),
});

router.post("/generate-spec", requireApiKey, async (req: Request, res: Response) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    res.status(503).json({ success: false, error: "ANTHROPIC_API_KEY is not configured" });
    return;
  }

  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  try {
    const spec = await generateSpec(parsed.data);
    res.json({ success: true, testId: parsed.data.testId, spec });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
