function readEnv(name: string) {
  const value = process.env[name];

  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export function getRequiredEnv(name: string) {
  return readEnv(name);
}

export function getPublicAppUrl() {
  return process.env.PIXL_PUBLIC_URL?.trim() || null;
}

export function getWebhookSecret() {
  return process.env.WEBHOOK_SECRET?.trim() || null;
}
