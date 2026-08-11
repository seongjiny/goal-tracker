"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatKoreanDate, shiftDateKey, toDateKey } from "@/lib/date";
import type { AppUser, DailyItem, DailyRecord, Household } from "@/lib/types";

type Page = "today" | "history" | "items" | "archive" | "household";
type ItemDraft = { id?: string; title: string; icon: string; color: string };

const DEMO_USER: AppUser = { id: "demo-user", nickname: "우리", avatarUrl: null };
const DEMO_HOUSEHOLD: Household = { id: "demo-household", name: "우리 집", invite_code: "DEMO2026" };
const ICON_OPTIONS = [
  { value: "✓", label: "완료" },
  { value: "🙏", label: "기도" },
  { value: "💻", label: "노트북과 개발" },
  { value: "💊", label: "영양제와 약" },
  { value: "🏃", label: "달리기" },
  { value: "🏋️", label: "근력 운동" },
  { value: "🚶", label: "걷기" },
  { value: "🦮", label: "강아지 산책" },
  { value: "🐶", label: "강아지" },
  { value: "🐱", label: "고양이" },
  { value: "📒", label: "기록" },
  { value: "✍️", label: "글쓰기" },
  { value: "📚", label: "독서" },
  { value: "💧", label: "물 마시기" },
  { value: "🥗", label: "건강한 식사" },
  { value: "🧹", label: "청소" },
  { value: "💰", label: "재정 관리" },
  { value: "🛌", label: "수면" },
  { value: "🌱", label: "성장" },
  { value: "❤️", label: "사랑과 관계" },
  { value: "🎯", label: "목표" },
  { value: "🗓️", label: "일정" },
  { value: "☕", label: "휴식" },
] as const;
const COLOR_OPTIONS = [
  { value: "green", label: "초록" },
  { value: "teal", label: "청록" },
  { value: "blue", label: "파랑" },
  { value: "sky", label: "하늘" },
  { value: "yellow", label: "노랑" },
  { value: "orange", label: "주황" },
  { value: "red", label: "빨강" },
  { value: "pink", label: "분홍" },
  { value: "purple", label: "보라" },
  { value: "gray", label: "회색" },
] as const;
const DEMO_ITEMS: DailyItem[] = [
  { id: "vitamin", household_id: "demo-household", created_by: "demo-user", title: "영양제 먹기", icon: "💊", color: "green", sort_order: 0, archived_at: null, created_at: new Date().toISOString() },
  { id: "exercise", household_id: "demo-household", created_by: "demo-user", title: "30분 운동", icon: "🏃", color: "blue", sort_order: 1, archived_at: null, created_at: new Date().toISOString() },
  { id: "expense", household_id: "demo-household", created_by: "demo-user", title: "지출 기록", icon: "📒", color: "yellow", sort_order: 2, archived_at: null, created_at: new Date().toISOString() },
  { id: "reading", household_id: "demo-household", created_by: "demo-user", title: "함께 책 읽기", icon: "📚", color: "purple", sort_order: 3, archived_at: null, created_at: new Date().toISOString() },
];

function seedDemoRecords(): DailyRecord[] {
  const today = toDateKey();
  return Array.from({ length: 7 }).flatMap((_, index) => {
    const date = shiftDateKey(today, -index);
    return DEMO_ITEMS.filter((_, itemIndex) => (index + itemIndex) % 3 !== 1).map((item) => ({
      id: `${item.id}-${date}`,
      item_id: item.id,
      recorded_by: "demo-user",
      record_date: date,
      count: 1,
      completed_at: new Date().toISOString(),
    }));
  });
}

export function GoalTrackerApp({ mode, user = DEMO_USER }: { mode: "demo" | "supabase"; user?: AppUser }) {
  const [page, setPage] = useState<Page>("today");
  const [selectedDate, setSelectedDate] = useState(toDateKey());
  const [items, setItems] = useState<DailyItem[]>(mode === "demo" ? DEMO_ITEMS : []);
  const [records, setRecords] = useState<DailyRecord[]>(mode === "demo" ? seedDemoRecords() : []);
  const [household, setHousehold] = useState<Household | null>(mode === "demo" ? DEMO_HOUSEHOLD : null);
  const [loading, setLoading] = useState(mode === "supabase");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<ItemDraft | null>(null);
  const [inviteCode, setInviteCode] = useState("");

  const navigate = useCallback((nextPage: Page) => {
    if (nextPage === page) return;
    window.history.pushState({ ...window.history.state, goalTrackerPage: nextPage }, "");
    setPage(nextPage);
  }, [page]);

  useEffect(() => {
    window.history.replaceState({ ...window.history.state, goalTrackerPage: "today" }, "");
    const handlePopState = (event: PopStateEvent) => {
      const previousPage = event.state?.goalTrackerPage;
      if ((["today", "history", "items", "archive", "household"] as Page[]).includes(previousPage)) setPage(previousPage);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const persistDemo = useCallback((nextItems: DailyItem[], nextRecords: DailyRecord[]) => {
    if (mode === "demo") localStorage.setItem("goal-tracker-demo-v1", JSON.stringify({ items: nextItems, records: nextRecords }));
  }, [mode]);

  const loadData = useCallback(async () => {
    if (mode === "demo") {
      const saved = localStorage.getItem("goal-tracker-demo-v1");
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { items: DailyItem[]; records: DailyRecord[] };
          setItems(parsed.items);
          setRecords(parsed.records);
        } catch { localStorage.removeItem("goal-tracker-demo-v1"); }
      }
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: membership, error: membershipError } = await supabase
      .from("household_members")
      .select("household_id, households!inner(id,name,invite_code)")
      .eq("user_id", user.id)
      .single();
    if (membershipError) { setNotice("공유 공간을 불러오지 못했습니다."); setLoading(false); return; }

    const joined = membership.households as unknown as Household;
    setHousehold(joined);
    const start = shiftDateKey(toDateKey(), -90);
    const [{ data: itemData, error: itemError }, { data: recordData, error: recordError }] = await Promise.all([
      supabase.from("daily_items").select("*").eq("household_id", joined.id).eq("created_by", user.id).order("sort_order"),
      supabase.from("daily_records").select("*").eq("recorded_by", user.id).gte("record_date", start).lte("record_date", toDateKey()),
    ]);
    if (itemError || recordError) setNotice("일부 기록을 불러오지 못했습니다.");
    setItems((itemData ?? []) as DailyItem[]);
    setRecords((recordData ?? []) as DailyRecord[]);
    setLoading(false);
  }, [mode, user.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void loadData(); }, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  const activeItems = useMemo(() => items.filter((item) => !item.archived_at).sort((a, b) => a.sort_order - b.sort_order), [items]);
  const archivedItems = useMemo(() => items.filter((item) => item.archived_at), [items]);
  const completedIds = useMemo(() => new Set(records.filter((record) => record.record_date === selectedDate && record.count > 0).map((record) => record.item_id)), [records, selectedDate]);
  const completedCount = activeItems.filter((item) => completedIds.has(item.id)).length;
  const percentage = activeItems.length ? Math.round((completedCount / activeItems.length) * 100) : 0;

  function streak(itemId: string) {
    const dates = new Set(records.filter((record) => record.item_id === itemId && record.count > 0).map((record) => record.record_date));
    let count = 0;
    let cursor = toDateKey();
    while (dates.has(cursor)) { count += 1; cursor = shiftDateKey(cursor, -1); }
    return count;
  }

  async function toggleItem(item: DailyItem) {
    const existing = records.find((record) => record.item_id === item.id && record.record_date === selectedDate);
    if (mode === "demo") {
      const next = existing
        ? records.filter((record) => record.id !== existing.id)
        : [...records, { id: crypto.randomUUID(), item_id: item.id, recorded_by: user.id, record_date: selectedDate, count: 1, completed_at: new Date().toISOString() }];
      setRecords(next); persistDemo(items, next); return;
    }
    const supabase = createClient();
    if (existing) {
      const { error } = await supabase.from("daily_records").delete().eq("id", existing.id);
      if (!error) setRecords((current) => current.filter((record) => record.id !== existing.id));
      else setNotice("완료 취소에 실패했습니다.");
    } else {
      const { data, error } = await supabase.from("daily_records").upsert({ item_id: item.id, recorded_by: user.id, record_date: selectedDate, count: 1, completed_at: new Date().toISOString() }, { onConflict: "item_id,record_date" }).select().single();
      if (!error && data) setRecords((current) => [...current.filter((record) => !(record.item_id === item.id && record.record_date === selectedDate)), data as DailyRecord]);
      else setNotice("완료 기록에 실패했습니다.");
    }
  }

  async function saveItem() {
    if (!draft || !draft.title.trim() || !household) return;
    if (mode === "demo") {
      const next = draft.id
        ? items.map((item) => item.id === draft.id ? { ...item, title: draft.title.trim(), icon: draft.icon, color: draft.color } : item)
        : [...items, { id: crypto.randomUUID(), household_id: household.id, created_by: user.id, title: draft.title.trim(), icon: draft.icon, color: draft.color, sort_order: activeItems.length, archived_at: null, created_at: new Date().toISOString() }];
      setItems(next); persistDemo(next, records); setDraft(null); return;
    }
    const supabase = createClient();
    if (draft.id) {
      const { data, error } = await supabase.from("daily_items").update({ title: draft.title.trim(), icon: draft.icon, color: draft.color }).eq("id", draft.id).select().single();
      if (!error && data) setItems((current) => current.map((item) => item.id === draft.id ? data as DailyItem : item));
      else { setNotice("항목 수정에 실패했습니다."); return; }
    } else {
      const { data, error } = await supabase.from("daily_items").insert({ household_id: household.id, created_by: user.id, title: draft.title.trim(), icon: draft.icon, color: draft.color, sort_order: activeItems.length }).select().single();
      if (!error && data) setItems((current) => [...current, data as DailyItem]);
      else { setNotice("항목 추가에 실패했습니다."); return; }
    }
    setDraft(null);
  }

  async function setArchived(item: DailyItem, archived: boolean) {
    const archivedAt = archived ? new Date().toISOString() : null;
    if (mode === "supabase") {
      const { error } = await createClient().from("daily_items").update({ archived_at: archivedAt }).eq("id", item.id);
      if (error) { setNotice("항목 상태 변경에 실패했습니다."); return; }
    }
    const next = items.map((current) => current.id === item.id ? { ...current, archived_at: archivedAt } : current);
    setItems(next); persistDemo(next, records);
  }

  async function joinHousehold() {
    if (mode === "demo") { setNotice("Supabase 연결 후 초대 코드를 사용할 수 있습니다."); return; }
    const { error } = await createClient().rpc("join_household", { code: inviteCode });
    if (error) { setNotice("초대 코드를 확인해 주세요."); return; }
    setInviteCode(""); setNotice("공유 공간에 참여했습니다."); await loadData();
  }

  async function logout() {
    if (mode === "supabase") { await createClient().auth.signOut(); window.location.reload(); }
  }

  const weekDates = Array.from({ length: 7 }, (_, index) => shiftDateKey(toDateKey(), index - 6));

  return (
    <main className="app-stage">
      <section className="app-shell">
        {mode === "demo" && <div className="config-banner"><b>미리보기 모드</b><span>.env에 Supabase 값을 넣으면 카카오 로그인과 DB가 활성화됩니다.</span></div>}
        {notice && <button className="notice" onClick={() => setNotice("")}>{notice}<span>×</span></button>}
        {loading ? <div className="loading">기록을 불러오는 중…</div> : (
          <>
            {page === "today" && <section className="app-page">
              <header className="app-header"><div><p>우리의 하루</p><h1>{user.nickname}님, 좋은 하루예요</h1></div><button className="circle-button" onClick={() => navigate("household")} aria-label="공유 공간 설정">⚙</button></header>
              <div className="date-switcher"><button onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}>‹</button><div><strong>{formatKoreanDate(selectedDate)}</strong><span>{selectedDate === toDateKey() ? "오늘" : selectedDate}</span></div><button onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))} disabled={selectedDate >= toDateKey()}>›</button></div>
              <div className="progress-panel"><div><strong>{completedCount} / {activeItems.length} 완료</strong><span>{percentage}%</span></div><div className="progress-bar"><i style={{ width: `${percentage}%` }} /></div></div>
              <div className="section-title"><span>오늘의 기록</span><small>눌러서 완료 · 왼쪽으로 밀어 편집</small></div>
              <div className="daily-list">{activeItems.length ? activeItems.map((item) => <SwipeableDailyRow key={item.id} item={item} completed={completedIds.has(item.id)} streakDays={streak(item.id)} onToggle={() => toggleItem(item)} onEdit={() => setDraft({ id: item.id, title: item.title, icon: item.icon ?? "✓", color: item.color ?? "green" })} />) : <EmptyState onAdd={() => { navigate("items"); setDraft({ title: "", icon: "✓", color: "green" }); }} />}</div>
            </section>}

            {page === "history" && <section className="app-page"><header className="app-header"><div><p>최근 기록</p><h1>지난 7일</h1></div><span className="header-symbol">▦</span></header><div className="history-grid"><span></span>{weekDates.map((date) => <span className="history-head" key={date}>{date === toDateKey() ? "오늘" : new Intl.DateTimeFormat("ko", { weekday: "short", timeZone: "UTC" }).format(new Date(`${date}T12:00:00Z`))}</span>)}{activeItems.map((item) => <div className="history-row" key={item.id}><span>{item.title}</span>{weekDates.map((date) => <i className={records.some((record) => record.item_id === item.id && record.record_date === date) ? "hit" : ""} key={date}>{records.some((record) => record.item_id === item.id && record.record_date === date) ? "✓" : "–"}</i>)}</div>)}</div><div className="stat-grid"><div><span>가장 긴 현재 기록</span><strong>{Math.max(0, ...activeItems.map((item) => streak(item.id)))}일</strong></div><div><span>최근 7일 완료율</span><strong>{activeItems.length ? Math.round(records.filter((record) => weekDates.includes(record.record_date) && activeItems.some((item) => item.id === record.item_id)).length / (activeItems.length * 7) * 100) : 0}%</strong></div></div></section>}

            {page === "items" && <section className="app-page"><header className="app-header"><div><p>설정</p><h1>항목 관리</h1></div><button className="circle-button" onClick={() => navigate("archive")} aria-label="보관함">▣</button></header><div className="section-title"><span>활성 항목 {activeItems.length}개</span><small>항목을 눌러 수정</small></div><div className="manage-list">{activeItems.map((item) => <div className="manage-row" key={item.id}><span className="drag">⠿</span><button className="manage-main" onClick={() => setDraft({ id: item.id, title: item.title, icon: item.icon ?? "✓", color: item.color ?? "green" })}><span>{item.icon}</span><b>{item.title}</b></button><button className="archive-action" onClick={() => setArchived(item, true)} aria-label="보관">▣</button></div>)}</div><button className="primary-button" onClick={() => setDraft({ title: "", icon: "✓", color: "green" })}>＋ 새 항목 추가</button><p className="helper-copy">보관한 항목의 과거 기록은 유지됩니다.</p></section>}

            {page === "archive" && <section className="app-page"><button className="back-button" onClick={() => setPage("items")}>‹ 항목 관리</button><header className="app-header"><div><p>중단한 기록</p><h1>보관함</h1></div></header><div className="section-title"><span>보관된 항목 {archivedItems.length}개</span><small>과거 기록 유지</small></div><div className="archive-list">{archivedItems.length ? archivedItems.map((item) => <div className="archive-row" key={item.id}><span className={`item-icon ${item.color ?? "green"}`}>{item.icon}</span><span><b>{item.title}</b><small>보관된 항목</small></span><button onClick={() => setArchived(item, false)}>복원</button></div>) : <p className="empty-copy">보관된 항목이 없습니다.</p>}</div></section>}

            {page === "household" && <section className="app-page"><button className="back-button" onClick={() => setPage("today")}>‹ 오늘</button><header className="app-header"><div><p>함께 쓰기</p><h1>{household?.name ?? "우리 집"}</h1></div></header><div className="invite-card"><span>배우자 초대 코드</span><strong>{household?.invite_code ?? "-"}</strong><button onClick={() => household && navigator.clipboard.writeText(household.invite_code)}>코드 복사</button></div><div className="form-block"><label htmlFor="invite">받은 초대 코드</label><input id="invite" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="8자리 코드" maxLength={8} /><button className="primary-button" onClick={joinHousehold} disabled={!inviteCode.trim()}>공유 공간 참여</button></div>{mode === "supabase" && <button className="logout-button" onClick={logout}>로그아웃</button>}</section>}

            {draft && <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-labelledby="item-dialog-title"><div className="item-dialog"><div className="dialog-header"><div><p>Daily Item</p><h2 id="item-dialog-title">{draft.id ? "항목 수정" : "새 항목 추가"}</h2></div><button onClick={() => setDraft(null)} aria-label="닫기">×</button></div><label>항목 이름<input autoFocus value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="예: 영양제 먹기" maxLength={80} /></label><fieldset><legend>아이콘</legend><div className="icon-options">{ICON_OPTIONS.map((icon) => <button className={draft.icon === icon.value ? "selected" : ""} aria-label={icon.label} title={icon.label} key={icon.value} onClick={() => setDraft({ ...draft, icon: icon.value })}>{icon.value}</button>)}</div></fieldset><fieldset><legend>색상</legend><div className="color-options">{COLOR_OPTIONS.map((color) => <button className={`${color.value} ${draft.color === color.value ? "selected" : ""}`} aria-label={color.label} title={color.label} key={color.value} onClick={() => setDraft({ ...draft, color: color.value })} />)}</div></fieldset><div className="dialog-actions"><button onClick={() => setDraft(null)}>취소</button><button className="primary-button" onClick={saveItem} disabled={!draft.title.trim()}>저장</button></div></div></div>}

            {!(["archive", "household"] as Page[]).includes(page) && <nav className="bottom-nav"><button className={page === "today" ? "active" : ""} onClick={() => navigate("today")}><b>✓</b><span>오늘</span></button><button className={page === "history" ? "active" : ""} onClick={() => navigate("history")}><b>▥</b><span>기록</span></button><button className={page === "items" ? "active" : ""} onClick={() => navigate("items")}><b>☷</b><span>항목 관리</span></button></nav>}
          </>
        )}
      </section>
    </main>
  );
}

function SwipeableDailyRow({ item, completed, streakDays, onToggle, onEdit }: { item: DailyItem; completed: boolean; streakDays: number; onToggle: () => void; onEdit: () => void }) {
  const [offset, setOffset] = useState(0);
  const drag = useRef({ startX: 0, startY: 0, initialOffset: 0, moved: false });

  function finishSwipe() {
    setOffset((current) => current < -42 ? -76 : 0);
  }

  return <div className={`daily-swipe ${offset < 0 ? "is-open" : ""}`}>
    <button className="daily-edit-action" onClick={() => { setOffset(0); onEdit(); }} aria-label={`${item.title} 편집`}>편집</button>
    <button
      className={`daily-row ${completed ? "is-done" : ""}`}
      style={{ transform: `translateX(${offset}px)` }}
      onPointerDown={(event) => { drag.current = { startX: event.clientX, startY: event.clientY, initialOffset: offset, moved: false }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={(event) => {
        if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
        const deltaX = event.clientX - drag.current.startX;
        const deltaY = event.clientY - drag.current.startY;
        if (Math.abs(deltaY) > Math.abs(deltaX)) return;
        if (Math.abs(deltaX) > 6) drag.current.moved = true;
        setOffset(Math.max(-76, Math.min(0, drag.current.initialOffset + deltaX)));
      }}
      onPointerUp={finishSwipe}
      onPointerCancel={finishSwipe}
      onClick={() => { if (drag.current.moved) { drag.current.moved = false; return; } if (offset < 0) { setOffset(0); return; } onToggle(); }}
    >
      <span className={`item-icon ${item.color ?? "green"}`}>{item.icon ?? "✓"}</span>
      <span><b>{item.title}</b><small>{streakDays ? `연속 ${streakDays}일` : "오늘부터 시작"}</small></span>
      <span className="completion-control" aria-hidden="true"><svg viewBox="0 0 20 20"><path d="m5 10 3.2 3.2L15.5 6.8" /></svg></span>
    </button>
  </div>;
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return <div className="empty-state"><span>✓</span><h2>첫 Daily Item을 만들어 보세요</h2><p>오늘 기록할 작은 습관부터 시작하면 됩니다.</p><button className="primary-button" onClick={onAdd}>항목 추가</button></div>;
}
