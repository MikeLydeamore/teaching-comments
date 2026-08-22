import { getAuth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";

let handlers: { GET: (request: Request) => Promise<Response>; POST: (request: Request) => Promise<Response> } | null = null;

function authHandlers() {
  if (!handlers) {
    handlers = toNextJsHandler(getAuth());
  }

  return handlers;
}

export async function GET(request: Request) {
  return authHandlers().GET(request);
}

export async function POST(request: Request) {
  return authHandlers().POST(request);
}
