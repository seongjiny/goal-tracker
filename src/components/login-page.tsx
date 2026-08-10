"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function LoginPage({ hasError = false }: { hasError?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(hasError ? "로그인 처리 중 문제가 발생했습니다." : "");

  async function login() {
    setLoading(true);
    setMessage("");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setMessage(error.message);
      setLoading(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="brand-mark">✓</div>
        <p className="login-eyebrow">우리 둘의 작은 기록</p>
        <h1>Goal Tracker</h1>
        <p className="login-copy">매일의 목표와 습관을 함께 기록하고, 꾸준함을 눈으로 확인해 보세요.</p>
        <button className="kakao-button" type="button" onClick={login} disabled={loading}>
          <span className="kakao-symbol">●</span>{loading ? "카카오로 이동 중…" : "카카오로 시작하기"}
        </button>
        {message && <p className="form-error">{message}</p>}
      </section>
    </main>
  );
}
