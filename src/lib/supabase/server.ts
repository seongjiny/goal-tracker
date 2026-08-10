import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseConfig } from "./config";

export async function createClient() {
  const { url, key, isConfigured } = getSupabaseConfig();
  if (!isConfigured) throw new Error("Supabase 환경변수가 설정되지 않았습니다.");
  const cookieStore = await cookies();

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Component에서는 proxy가 세션 갱신을 담당한다.
        }
      },
    },
  });
}
