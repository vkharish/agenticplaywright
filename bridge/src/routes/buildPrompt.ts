import { Router, Request, Response } from "express";
import { z } from "zod";
import { requireApiKey } from "../middleware/apiKey";
import { buildPrompt } from "../services/claude";

const router = Router();

const BuildPromptSchema = z.object({
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

/**
 * POST /build-prompt
 *
 * Builds the Claude prompt from a snapshot + test metadata and returns it as a
 * string — WITHOUT making any Claude API call. No ANTHROPIC_API_KEY needed.
 *
 * Used by the corporate n8n Option C workflow: n8n calls this to get the
 * ready-made prompt, then passes it to its own LLM node (Claude Sonnet with
 * the corporate API key managed by n8n).
 *
 * Request body: same fields as /generate-spec
 * Response:     { success: true, prompt: "<full prompt string>" }
 */
router.post("/build-prompt", requireApiKey, (req: Request, res: Response) => {
  const parsed = BuildPromptSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const prompt = buildPrompt(parsed.data);
  res.json({ success: true, prompt });
});

export default router;
