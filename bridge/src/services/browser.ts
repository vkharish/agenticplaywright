import { Browser, BrowserContext, Page, chromium } from "playwright";

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface PageSession {
  context: BrowserContext;
  page: Page;
}

export async function newSession(auth?: {
  username: string;
  password: string;
}): Promise<PageSession> {
  const b = await getBrowser();
  const contextOptions: Parameters<Browser["newContext"]>[0] = {};
  if (auth) {
    contextOptions.httpCredentials = {
      username: auth.username,
      password: auth.password,
    };
  }
  const context = await b.newContext(contextOptions);
  const page = await context.newPage();
  return { context, page };
}

export async function closeSession(session: PageSession): Promise<void> {
  await session.page.close();
  await session.context.close();
}
