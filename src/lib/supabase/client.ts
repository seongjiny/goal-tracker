import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseConfig } from "./config";

export function createClient() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  return createBrowserClient(url, key);
}
