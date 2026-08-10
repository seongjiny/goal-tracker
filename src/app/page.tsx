import { GoalTrackerApp } from "@/components/goal-tracker-app";
import { LoginPage } from "@/components/login-page";
import { getSupabaseConfig } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: PageProps<"/">) {
  const { isConfigured } = getSupabaseConfig();
  if (!isConfigured) return <GoalTrackerApp mode="demo" />;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const params = await searchParams;
  if (!user) return <LoginPage hasError={params.authError === "1"} />;

  const metadata = user.user_metadata;
  return <GoalTrackerApp mode="supabase" user={{
    id: user.id,
    nickname: metadata.user_name ?? metadata.full_name ?? metadata.name ?? "사용자",
    avatarUrl: metadata.avatar_url ?? metadata.picture ?? null,
  }} />;
}
