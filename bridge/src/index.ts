import dotenv from "dotenv";
import path from "path";
// Load root .env first (app credentials: MY_APP_USERNAME etc.)
// then bridge/.env (ANTHROPIC_API_KEY, BRIDGE_API_KEY — overrides root if same key)
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import { getBrowser, closeBrowser } from "./services/browser";
import healthRouter from "./routes/health";
import snapshotRouter from "./routes/snapshot";
import healRouter from "./routes/heal";
import generateRouter from "./routes/generate";
import writeSpecRouter from "./routes/writeSpec";
import buildPromptRouter from "./routes/buildPrompt";

const app = express();
app.use(express.json({ limit: "2mb" }));

app.use(healthRouter);
app.use(snapshotRouter);
app.use(healRouter);
app.use(generateRouter);
app.use(writeSpecRouter);
app.use(buildPromptRouter);

const PORT = Number(process.env.PORT ?? 3000);

async function main() {
  await getBrowser();
  console.log("Browser ready.");

  const server = app.listen(PORT, () => {
    console.log(`Bridge listening on http://localhost:${PORT}`);
    if (process.env.ANTHROPIC_API_KEY) {
      console.log("Claude API key loaded — /generate-spec is active.");
    } else {
      console.log("ANTHROPIC_API_KEY not set — /generate-spec will return 503.");
    }
  });

  const shutdown = async () => {
    console.log("Shutting down…");
    server.close();
    await closeBrowser();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
