import { Router, Request, Response } from "express";
import { getBrowser } from "../services/browser";

const router = Router();

router.get("/health", async (_req: Request, res: Response) => {
  try {
    const browser = await getBrowser();
    const connected = browser.isConnected();
    res.json({ status: "ok", browser: connected ? "connected" : "disconnected" });
  } catch {
    res.status(503).json({ status: "error", browser: "unavailable" });
  }
});

export default router;
