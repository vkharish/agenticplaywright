import { Router, Request, Response } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { requireApiKey } from "../middleware/apiKey";

const router = Router();

const WriteSpecSchema = z.object({
  testId: z.string(),
  spec: z.string(),
});

const SPECS_DIR = path.resolve(__dirname, "../../../..", "tests", "zephyr");

router.post("/write-spec", requireApiKey, (req: Request, res: Response) => {
  const parsed = WriteSpecSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ success: false, errors: parsed.error.flatten() });
    return;
  }

  const { testId, spec } = parsed.data;

  try {
    fs.mkdirSync(SPECS_DIR, { recursive: true });
    const filePath = path.join(SPECS_DIR, `${testId}.spec.ts`);
    fs.writeFileSync(filePath, spec, "utf8");
    res.json({ success: true, testId, filePath });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ success: false, error: message });
  }
});

export default router;
