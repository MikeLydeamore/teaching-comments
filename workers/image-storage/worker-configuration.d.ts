// Generated bindings are intentionally kept local to this Worker package.
interface Env {
  IMAGES: R2Bucket;
  CLIENT_RATE: RateLimit;
  SESSION_RATE: RateLimit;
  TICKET_SECRET: string;
  SERVICE_TOKEN: string;
  ALLOWED_ORIGINS: string;
}
