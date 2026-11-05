import { getCurrentUser } from "@/lib/auth/sessions";
import { handlePushDevicesRequest } from "@/lib/http/push-devices";

export async function POST(request: Request) {
  return handlePushDevicesRequest(request, await getCurrentUser());
}

export async function DELETE(request: Request) {
  return handlePushDevicesRequest(request, await getCurrentUser());
}
