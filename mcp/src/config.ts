import { config } from "dotenv";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "../.env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export const SUPABASE_URL = requireEnv("SUPABASE_URL");
export const SUPABASE_SERVICE_ROLE_KEY = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
export const TROVE_USER_ID = requireEnv("TROVE_USER_ID");
export const ANTHROPIC_API_KEY = optionalEnv("ANTHROPIC_API_KEY");
export const JINA_API_KEY = optionalEnv("JINA_API_KEY");
