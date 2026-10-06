import { purgeDeletedTeacherSpaces } from "@/lib/edie-store";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (
    !secret
    || secret.length < 16
    || request.headers.get("authorization") !== `Bearer ${secret}`
  ) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }

  const purged = await purgeDeletedTeacherSpaces();
  return Response.json({ purged });
}
