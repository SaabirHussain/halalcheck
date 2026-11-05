import { handleResendWebhook } from "@/lib/http/resend-webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleResendWebhook(request);
}
