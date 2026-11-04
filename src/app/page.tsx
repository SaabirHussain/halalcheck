import { listPublicBranches } from "@/lib/domain/public";
import { getCurrentUser } from "@/lib/auth/sessions";
import { Discovery } from "./ui";

export default async function HomePage() {
  const [places, user] = await Promise.all([listPublicBranches({ limit: 100 }), getCurrentUser()]);
  return <Discovery places={places} userName={user?.displayName ?? null} />;
}
