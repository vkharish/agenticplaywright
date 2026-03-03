import { Request, Response, NextFunction } from "express";

export function requireApiKey(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = process.env.BRIDGE_API_KEY;
  if (!apiKey) {
    // No key configured → open (dev mode only)
    next();
    return;
  }
  const provided = req.headers["x-api-key"];
  if (provided !== apiKey) {
    res.status(401).json({ success: false, error: "Invalid or missing x-api-key" });
    return;
  }
  next();
}
