/**
 * env.ts — Safe environment variable accessor.
 *
 * Throws a descriptive error at test startup if a required variable is missing,
 * rather than failing silently mid-test with a confusing undefined error.
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(
      `[env] Required environment variable "${key}" is not set.\n` +
      `  • Locally: copy .env.example → .env and fill in the value.\n` +
      `  • CI: add it as a repository secret or pipeline env var.`
    );
  }
  return value;
}

export function optionalEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

// ── Pre-resolved singletons used across tests ──────────────────────────────────
export const BASE_URL       = optionalEnv('BASE_URL', 'https://staging.myapp.com');

// Default test account — used when a spec doesn't need app-specific credentials
export const TEST_USERNAME  = optionalEnv('TEST_USERNAME', '');
export const TEST_PASSWORD  = optionalEnv('TEST_PASSWORD', '');

/**
 * Look up credentials for a specific app by prefix.
 *
 * In .env:
 *   THE_INTERNET_USERNAME=tomsmith
 *   THE_INTERNET_PASSWORD=SuperSecretPassword!
 *
 * In spec:
 *   const { username, password } = appCredentials('THE_INTERNET');
 */
export function appCredentials(appPrefix: string): { username: string; password: string } {
  return {
    username: requireEnv(`${appPrefix}_USERNAME`),
    password: requireEnv(`${appPrefix}_PASSWORD`),
  };
}
