"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatKoreanDate, shiftDateKey, toDateKey } from "@/lib/date";
import {
  getGoalProgressLabel,
  getStreak,
  getWeeklyProgress,
  isGoalAchievedForPeriod,
  isGoalScheduledOn,
  isGoalSuccessful,
} from "@/lib/goals/domain";
import {
  LocalGoalRepository,
  SupabaseGoalRepository,
  type GoalRepository,
} from "@/lib/goals/repository";
import { createClient } from "@/lib/supabase/client";
import type {
  AppUser,
  GoalItem,
  GoalItemInput,
  GoalRecord,
  GoalSchedule,
  GoalType,
  NumericComparison,
  Space,
  WorkspaceData,
} from "@/lib/types";

type Page = "today" | "history" | "items" | "archive" | "space";
type Draft = Omit<GoalItemInput, "household_id"> & { id?: string };
const EMPTY_DATA: WorkspaceData = { spaces: [], items: [], records: [] };
const DEMO_USER: AppUser = {
  id: "demo-user",
  nickname: "우리",
  avatarUrl: null,
};
const ICONS = [
  "✓",
  "🙏",
  "💻",
  "💊",
  "🏃",
  "🏋️",
  "🚶",
  "🦮",
  "🐶",
  "🐱",
  "📒",
  "✍️",
  "📚",
  "💧",
  "🥗",
  "🧹",
  "💰",
  "🛌",
  "🌱",
  "❤️",
  "🎯",
  "🗓️",
  "☕",
  "📱",
];
const COLORS = [
  "green",
  "teal",
  "blue",
  "sky",
  "yellow",
  "orange",
  "red",
  "pink",
  "purple",
  "gray",
];
const UNITS = ["분", "시간", "회", "잔", "원", "kg"];

function newDraft(date: string): Draft {
  return {
    title: "",
    icon: "✓",
    color: "green",
    goal_type: "check",
    target_count: 1,
    comparison: null,
    min_value: null,
    max_value: null,
    unit: null,
    schedule: {
      frequency: "daily",
      interval: 1,
      days_of_week: null,
      target_count_per_period: null,
      day_of_month: null,
      starts_on: date,
      timezone: "Asia/Seoul",
    },
  };
}

export function GoalTrackerApp({
  mode,
  user = DEMO_USER,
}: {
  mode: "demo" | "supabase";
  user?: AppUser;
}) {
  const repository = useMemo<GoalRepository>(
    () =>
      mode === "demo"
        ? new LocalGoalRepository(user.id)
        : new SupabaseGoalRepository(user.id),
    [mode, user.id],
  );
  const [data, setData] = useState<WorkspaceData>(EMPTY_DATA);
  const [spaceId, setSpaceId] = useState("");
  const [page, setPage] = useState<Page>("today");
  const [selectedDate, setSelectedDate] = useState(toDateKey());
  const [draft, setDraft] = useState<Draft | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [numericDrafts, setNumericDrafts] = useState<Record<string, string>>(
    {},
  );
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);

  const load = useCallback(
    async (preferredSpaceId?: string) => {
      setLoading(true);
      try {
        const next = await repository.load();
        setData(next);
        setSpaceId((current) => {
          const preferred =
            preferredSpaceId ||
            current ||
            sessionStorage.getItem("goal-tracker-space") ||
            "";
          return next.spaces.some((space) => space.id === preferred)
            ? preferred
            : (next.spaces.find((space) => space.space_type === "personal")
                ?.id ??
                next.spaces[0]?.id ??
                "");
        });
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "데이터를 불러오지 못했습니다.",
        );
      } finally {
        setLoading(false);
      }
    },
    [repository],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (spaceId) sessionStorage.setItem("goal-tracker-space", spaceId);
  }, [spaceId]);
  useEffect(() => {
    window.history.replaceState(
      { ...window.history.state, goalTrackerPage: "today" },
      "",
    );
    const pop = (event: PopStateEvent) => {
      const value = event.state?.goalTrackerPage;
      if (["today", "history", "items", "archive", "space"].includes(value))
        setPage(value);
    };
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  const navigate = (next: Page) => {
    if (next === page) return;
    window.history.pushState(
      { ...window.history.state, goalTrackerPage: next },
      "",
    );
    setPage(next);
  };
  const run = async (action: () => Promise<void>) => {
    try {
      setNotice("");
      await action();
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "작업에 실패했습니다. 다시 시도해 주세요.",
      );
    }
  };
  const currentSpace =
    data.spaces.find((space) => space.id === spaceId) ?? null;
  const spaceItems = useMemo(
    () => data.items.filter((item) => item.household_id === spaceId),
    [data.items, spaceId],
  );
  const activeItems = useMemo(
    () =>
      spaceItems
        .filter((item) => !item.archived_at)
        .sort((a, b) => a.sort_order - b.sort_order),
    [spaceItems],
  );
  const visibleItems = useMemo(
    () => activeItems.filter((item) => isGoalScheduledOn(item, selectedDate)),
    [activeItems, selectedDate],
  );
  const archivedItems = spaceItems.filter((item) => item.archived_at);
  const ownRecord = (itemId: string, date = selectedDate) =>
    data.records.find(
      (record) =>
        record.item_id === itemId &&
        record.recorded_by === user.id &&
        record.record_date === date,
    );
  const ownRecords = data.records.filter(
    (record) => record.recorded_by === user.id,
  );
  const successfulCount = visibleItems.filter((item) =>
    isGoalAchievedForPeriod(item, ownRecords, selectedDate),
  ).length;
  const percentage = visibleItems.length
    ? Math.round((successfulCount / visibleItems.length) * 100)
    : 0;
  const weekDates = Array.from({ length: 7 }, (_, index) =>
    shiftDateKey(toDateKey(), index - 6),
  );

  async function saveRecord(
    item: GoalItem,
    patch: Partial<Pick<GoalRecord, "count" | "status" | "numeric_value">>,
  ) {
    if (selectedDate > toDateKey()) return;
    const previous = ownRecord(item.id);
    const saved = await repository.setRecord({
      item_id: item.id,
      record_date: selectedDate,
      count: patch.count ?? previous?.count ?? 0,
      status: patch.status ?? previous?.status ?? null,
      numeric_value: patch.numeric_value ?? previous?.numeric_value ?? null,
    });
    setData((current) => ({
      ...current,
      records: [
        ...current.records.filter(
          (record) =>
            !(
              record.item_id === item.id &&
              record.recorded_by === user.id &&
              record.record_date === selectedDate
            ),
        ),
        ...(saved ? [saved] : []),
      ],
    }));
  }

  async function saveItem() {
    if (!draft || !draft.title.trim() || !currentSpace) return;
    const input: GoalItemInput = {
      ...draft,
      title: draft.title.trim(),
      household_id: currentSpace.id,
      unit: draft.unit?.trim() || null,
    };
    delete (input as GoalItemInput & { id?: string }).id;
    const saved = await repository.saveItem(input, draft.id);
    setData((current) => ({
      ...current,
      items: draft.id
        ? current.items.map((item) => (item.id === draft.id ? saved : item))
        : [...current.items, saved],
    }));
    setDraft(null);
  }

  async function archive(item: GoalItem, archived: boolean) {
    await repository.archiveItem(item.id, archived);
    setData((current) => ({
      ...current,
      items: current.items.map((value) =>
        value.id === item.id
          ? {
              ...value,
              archived_at: archived ? new Date().toISOString() : null,
            }
          : value,
      ),
    }));
  }

  async function moveItem(itemId: string, direction: -1 | 1) {
    const index = activeItems.findIndex((item) => item.id === itemId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= activeItems.length) return;
    const reordered = [...activeItems];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    const previous = data.items;
    setData((current) => ({
      ...current,
      items: current.items.map((item) => {
        const nextIndex = reordered.findIndex((value) => value.id === item.id);
        return nextIndex < 0 ? item : { ...item, sort_order: nextIndex };
      }),
    }));
    try {
      await repository.reorderItems(reordered.map((item) => item.id));
    } catch (error) {
      setData((current) => ({ ...current, items: previous }));
      throw error;
    }
  }

  async function moveItemBefore(itemId: string, targetId: string) {
    if (itemId === targetId) return;
    const reordered = activeItems.filter((item) => item.id !== itemId);
    const targetIndex = reordered.findIndex((item) => item.id === targetId);
    const moving = activeItems.find((item) => item.id === itemId);
    if (!moving || targetIndex < 0) return;
    reordered.splice(targetIndex, 0, moving);
    await repository.reorderItems(reordered.map((item) => item.id));
    await load(spaceId);
  }

  if (loading)
    return (
      <main className="app-stage">
        <section className="app-shell">
          <div className="loading">목표를 불러오는 중…</div>
        </section>
      </main>
    );

  return (
    <main className="app-stage">
      <section className="app-shell">
        {mode === "demo" && (
          <div className="config-banner">
            <b>미리보기 모드</b>
            <span>데이터는 이 브라우저에 저장됩니다.</span>
          </div>
        )}
        {notice && (
          <button className="notice" onClick={() => setNotice("")}>
            {notice}
            <span>×</span>
          </button>
        )}

        {page === "today" && (
          <section className="app-page">
            <header className="app-header">
              <div>
                <p>
                  {currentSpace?.space_type === "shared"
                    ? "함께 만드는 하루"
                    : "나의 하루"}
                </p>
                <h1>{user.nickname}님, 좋은 하루예요</h1>
              </div>
              <button
                className="circle-button"
                onClick={() => navigate("space")}
                aria-label="공간 설정"
              >
                ⚙
              </button>
            </header>
            <SpaceSwitcher
              spaces={data.spaces}
              value={spaceId}
              onChange={setSpaceId}
              onAdd={() => navigate("space")}
            />
            <div className="date-switcher">
              <button
                onClick={() => setSelectedDate(shiftDateKey(selectedDate, -1))}
              >
                ‹
              </button>
              <div>
                <strong>{formatKoreanDate(selectedDate)}</strong>
                <span>
                  {selectedDate === toDateKey() ? "오늘" : selectedDate}
                </span>
              </div>
              <button
                onClick={() => setSelectedDate(shiftDateKey(selectedDate, 1))}
                disabled={selectedDate >= toDateKey()}
              >
                ›
              </button>
            </div>
            <div className="progress-panel">
              <div>
                <strong>
                  {successfulCount} / {visibleItems.length} 달성
                </strong>
                <span>{percentage}%</span>
              </div>
              <div className="progress-bar">
                <i style={{ width: `${percentage}%` }} />
              </div>
            </div>
            <div className="section-title">
              <span>오늘의 목표</span>
              <small>왼쪽으로 밀어 편집</small>
            </div>
            <div className="daily-list">
              {visibleItems.length ? (
                visibleItems.map((item) => (
                  <GoalRow
                    key={item.id}
                    item={item}
                    record={ownRecord(item.id)}
                    weeklyProgress={getWeeklyProgress(
                      item,
                      ownRecords,
                      selectedDate,
                    )}
                    streak={getStreak(item, ownRecords, toDateKey())}
                    numericDraft={numericDrafts[item.id] ?? ""}
                    onNumericDraft={(value) =>
                      setNumericDrafts((current) => ({
                        ...current,
                        [item.id]: value,
                      }))
                    }
                    onRecord={(patch) =>
                      void run(() => saveRecord(item, patch))
                    }
                    onEdit={() => setDraft(toDraft(item))}
                  />
                ))
              ) : (
                <EmptyState onAdd={() => setDraft(newDraft(selectedDate))} />
              )}
            </div>
          </section>
        )}

        {page === "history" && (
          <section className="app-page">
            <header className="app-header">
              <div>
                <p>{currentSpace?.name}</p>
                <h1>지난 7일</h1>
              </div>
              <span className="header-symbol">▦</span>
            </header>
            <SpaceSwitcher
              spaces={data.spaces}
              value={spaceId}
              onChange={setSpaceId}
              onAdd={() => navigate("space")}
            />
            <div className="history-grid">
              <span></span>
              {weekDates.map((date) => (
                <span className="history-head" key={date}>
                  {date === toDateKey()
                    ? "오늘"
                    : formatKoreanDate(date).slice(0, 1)}
                </span>
              ))}
              {activeItems.map((item) => (
                <div className="history-row" key={item.id}>
                  <span>{item.title}</span>
                  {weekDates.map((date) => {
                    const record = ownRecord(item.id, date);
                    return (
                      <i
                        className={
                          isGoalSuccessful(item, record)
                            ? "hit"
                            : record
                              ? "miss"
                              : ""
                        }
                        key={date}
                      >
                        {isGoalSuccessful(item, record)
                          ? "✓"
                          : record
                            ? "×"
                            : "–"}
                      </i>
                    );
                  })}
                </div>
              ))}
            </div>
          </section>
        )}

        {page === "items" && (
          <section className="app-page">
            <header className="app-header">
              <div>
                <p>{currentSpace?.name}</p>
                <h1>목표 관리</h1>
              </div>
              <button
                className="circle-button"
                onClick={() => navigate("archive")}
                aria-label="보관함"
              >
                ▣
              </button>
            </header>
            <SpaceSwitcher
              spaces={data.spaces}
              value={spaceId}
              onChange={setSpaceId}
              onAdd={() => navigate("space")}
            />
            <div className="section-title">
              <span>활성 목표 {activeItems.length}개</span>
              <small>드래그 또는 화살표로 정렬</small>
            </div>
            <div className="manage-list">
              {activeItems.map((item, index) => (
                <div
                  className={`manage-row ${draggedItemId === item.id ? "is-dragging" : ""}`}
                  key={item.id}
                  draggable
                  onDragStart={() => setDraggedItemId(item.id)}
                  onDragEnd={() => setDraggedItemId(null)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (draggedItemId)
                      void run(() => moveItemBefore(draggedItemId, item.id));
                    setDraggedItemId(null);
                  }}
                >
                  <div className="reorder-actions">
                    <button
                      disabled={index === 0}
                      onClick={() => void run(() => moveItem(item.id, -1))}
                    >
                      ↑
                    </button>
                    <button
                      disabled={index === activeItems.length - 1}
                      onClick={() => void run(() => moveItem(item.id, 1))}
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    className="manage-main"
                    onClick={() => setDraft(toDraft(item))}
                  >
                    <span>{item.icon}</span>
                    <span>
                      <b>{item.title}</b>
                      <small>{goalTypeLabel(item.goal_type)}</small>
                    </span>
                  </button>
                  <button
                    className="archive-action"
                    onClick={() => void run(() => archive(item, true))}
                    aria-label="보관"
                  >
                    ▣
                  </button>
                </div>
              ))}
            </div>
            <button
              className="primary-button"
              onClick={() => setDraft(newDraft(selectedDate))}
            >
              ＋ 새 목표 추가
            </button>
          </section>
        )}

        {page === "archive" && (
          <section className="app-page">
            <button
              className="back-button"
              onClick={() => window.history.back()}
            >
              ‹ 목표 관리
            </button>
            <header className="app-header">
              <div>
                <p>{currentSpace?.name}</p>
                <h1>보관함</h1>
              </div>
            </header>
            <div className="archive-list">
              {archivedItems.length ? (
                archivedItems.map((item) => (
                  <div className="archive-row" key={item.id}>
                    <span className={`item-icon ${item.color}`}>
                      {item.icon}
                    </span>
                    <span>
                      <b>{item.title}</b>
                      <small>{goalTypeLabel(item.goal_type)}</small>
                    </span>
                    <button
                      onClick={() => void run(() => archive(item, false))}
                    >
                      복원
                    </button>
                  </div>
                ))
              ) : (
                <p className="empty-copy">보관된 목표가 없습니다.</p>
              )}
            </div>
          </section>
        )}

        {page === "space" && (
          <SpacePage
            mode={mode}
            spaces={data.spaces}
            inviteCode={inviteCode}
            onInviteCode={setInviteCode}
            onBack={() => window.history.back()}
            onCreate={() =>
              void run(async () => {
                await repository.createSharedSpace("우리 공간");
                await load();
              })
            }
            onJoin={() =>
              void run(async () => {
                await repository.joinSharedSpace(inviteCode);
                setInviteCode("");
                await load();
              })
            }
            onLeave={(id) =>
              void run(async () => {
                await repository.leaveSharedSpace(id);
                await load();
              })
            }
            onLogout={async () => {
              if (mode === "supabase") {
                await createClient().auth.signOut();
                location.reload();
              }
            }}
          />
        )}

        {draft && currentSpace && (
          <ItemDialog
            draft={draft}
            onChange={setDraft}
            onClose={() => setDraft(null)}
            onSave={() => void run(saveItem)}
          />
        )}
        {!(["archive", "space"] as Page[]).includes(page) && (
          <nav className="bottom-nav">
            <button
              className={page === "today" ? "active" : ""}
              onClick={() => navigate("today")}
            >
              <b>✓</b>
              <span>오늘</span>
            </button>
            <button
              className={page === "history" ? "active" : ""}
              onClick={() => navigate("history")}
            >
              <b>▥</b>
              <span>기록</span>
            </button>
            <button
              className={page === "items" ? "active" : ""}
              onClick={() => navigate("items")}
            >
              <b>☷</b>
              <span>목표 관리</span>
            </button>
          </nav>
        )}
      </section>
    </main>
  );
}

function GoalRow({
  item,
  record,
  weeklyProgress,
  streak,
  numericDraft,
  onNumericDraft,
  onRecord,
  onEdit,
}: {
  item: GoalItem;
  record?: GoalRecord;
  weeklyProgress: { count: number; target: number } | null;
  streak: number;
  numericDraft: string;
  onNumericDraft: (value: string) => void;
  onRecord: (patch: Partial<GoalRecord>) => void;
  onEdit: () => void;
}) {
  const [offset, setOffset] = useState(0);
  const pointer = useRef({ x: 0, y: 0, moved: false });
  const success = isGoalSuccessful(item, record);
  const base = (
    <>
      <span className={`item-icon ${item.color}`}>{item.icon}</span>
      <span className="goal-copy">
        <b>{item.title}</b>
        <small>
          {weeklyProgress
            ? `이번 주 ${weeklyProgress.count}/${weeklyProgress.target}`
            : getGoalProgressLabel(item, record)}
          {streak ? ` · 연속 ${streak}일` : ""}
        </small>
      </span>
    </>
  );
  return (
    <div className="daily-swipe">
      <button className="daily-edit-action" onClick={onEdit}>
        편집
      </button>
      <div
        className={`daily-row ${(weeklyProgress ? weeklyProgress.count >= weeklyProgress.target : success) ? "is-done" : ""}`}
        style={{ transform: `translateX(${offset}px)` }}
        onPointerDown={(event) => {
          if ((event.target as HTMLElement).closest("button,input")) return;
          pointer.current = {
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
          const dx = event.clientX - pointer.current.x;
          const dy = event.clientY - pointer.current.y;
          if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 6) {
            pointer.current.moved = true;
            setOffset(Math.max(-76, Math.min(0, dx)));
          }
        }}
        onPointerUp={() => setOffset((value) => (value < -42 ? -76 : 0))}
      >
        {base}
        {item.goal_type === "check" && (
          <button
            className="completion-control"
            onClick={() => {
              if (pointer.current.moved) return;
              onRecord({
                count: success ? 0 : 1,
                status: null,
                numeric_value: null,
              });
            }}
            aria-label={success ? "완료 취소" : "완료"}
          >
            <svg viewBox="0 0 20 20">
              <path d="m5 10 3.2 3.2L15.5 6.8" />
            </svg>
          </button>
        )}
        {item.goal_type === "count" && (
          <div className="count-control">
            <button
              onClick={() =>
                onRecord({
                  count: Math.max(0, (record?.count ?? 0) - 1),
                  status: null,
                  numeric_value: null,
                })
              }
            >
              −
            </button>
            <b>
              {record?.count ?? 0}/{item.target_count}
            </b>
            <button
              disabled={(record?.count ?? 0) >= item.target_count}
              onClick={() =>
                onRecord({
                  count: Math.min(item.target_count, (record?.count ?? 0) + 1),
                  status: null,
                  numeric_value: null,
                })
              }
            >
              ＋
            </button>
          </div>
        )}
        {item.goal_type === "restraint" && (
          <div className="restraint-control">
            <button
              className={record?.status === "failure" ? "selected failure" : ""}
              onClick={() =>
                onRecord({ count: 0, status: "failure", numeric_value: null })
              }
            >
              실패
            </button>
            <button
              className={record?.status === "success" ? "selected success" : ""}
              onClick={() =>
                onRecord({ count: 0, status: "success", numeric_value: null })
              }
            >
              지킴
            </button>
          </div>
        )}
        {item.goal_type === "numeric" && (
          <div className="numeric-control">
            <input
              type="number"
              step="any"
              value={numericDraft || record?.numeric_value?.toString() || ""}
              onChange={(event) => onNumericDraft(event.target.value)}
              aria-label={`${item.title} 측정값`}
            />
            <span>{item.unit}</span>
            <button
              disabled={!numericDraft}
              onClick={() => {
                const value = Number(numericDraft);
                if (Number.isFinite(value)) {
                  onRecord({ count: 0, status: null, numeric_value: value });
                  onNumericDraft("");
                }
              }}
            >
              저장
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function SpaceSwitcher({
  spaces,
  value,
  onChange,
  onAdd,
}: {
  spaces: Space[];
  value: string;
  onChange: (id: string) => void;
  onAdd: () => void;
}) {
  return (
    <div className="space-switcher">
      {spaces.map((space) => (
        <button
          key={space.id}
          className={space.id === value ? "active" : ""}
          onClick={() => onChange(space.id)}
        >
          {space.space_type === "personal" ? "내 공간" : space.name}
        </button>
      ))}
      {!spaces.some((space) => space.space_type === "shared") && (
        <button onClick={onAdd}>＋ 우리 공간</button>
      )}
    </div>
  );
}

function SpacePage({
  mode,
  spaces,
  inviteCode,
  onInviteCode,
  onBack,
  onCreate,
  onJoin,
  onLeave,
  onLogout,
}: {
  mode: "demo" | "supabase";
  spaces: Space[];
  inviteCode: string;
  onInviteCode: (value: string) => void;
  onBack: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onLeave: (id: string) => void;
  onLogout: () => void;
}) {
  const shared = spaces.find((space) => space.space_type === "shared");
  return (
    <section className="app-page">
      <button className="back-button" onClick={onBack}>
        ‹ 오늘
      </button>
      <header className="app-header">
        <div>
          <p>개인 데이터는 항상 분리됩니다</p>
          <h1>공간 관리</h1>
        </div>
      </header>
      {shared ? (
        <>
          <div className="invite-card">
            <span>
              {shared.name} · 구성원 {shared.member_count}명
            </span>
            <strong>{shared.invite_code}</strong>
            <button
              onClick={() => navigator.clipboard.writeText(shared.invite_code)}
            >
              초대 코드 복사
            </button>
          </div>
          <button
            className="danger-button"
            disabled={shared.member_count < 2}
            onClick={() => onLeave(shared.id)}
          >
            우리 공간 나가기
          </button>
          {shared.member_count < 2 && (
            <p className="helper-copy">
              마지막 구성원은 공간을 나갈 수 없습니다.
            </p>
          )}
        </>
      ) : (
        <>
          <div className="form-block">
            <button className="primary-button" onClick={onCreate}>
              우리 공간 만들기
            </button>
            <label htmlFor="invite">받은 초대 코드</label>
            <input
              id="invite"
              value={inviteCode}
              onChange={(event) =>
                onInviteCode(event.target.value.toUpperCase())
              }
              maxLength={8}
              placeholder="8자리 코드"
            />
            <button
              className="secondary-button"
              disabled={!inviteCode.trim()}
              onClick={onJoin}
            >
              초대 코드로 참여
            </button>
          </div>
        </>
      )}
      {mode === "supabase" && (
        <button className="logout-button" onClick={onLogout}>
          로그아웃
        </button>
      )}
    </section>
  );
}

function ItemDialog({
  draft,
  onChange,
  onClose,
  onSave,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onSave: () => void;
}) {
  const updateType = (goal_type: GoalType) =>
    onChange({
      ...draft,
      goal_type,
      target_count: goal_type === "count" ? Math.max(2, draft.target_count) : 1,
      comparison: goal_type === "numeric" ? (draft.comparison ?? "max") : null,
      min_value: goal_type === "numeric" ? draft.min_value : null,
      max_value: goal_type === "numeric" ? (draft.max_value ?? 1) : null,
      unit:
        goal_type === "numeric"
          ? (draft.unit ?? "시간")
          : goal_type === "count"
            ? (draft.unit ?? "회")
            : null,
    });
  const schedule = draft.schedule!;
  return (
    <div className="dialog-backdrop" role="dialog" aria-modal="true">
      <div className="item-dialog">
        <div className="dialog-header">
          <div>
            <p>Goal Item</p>
            <h2>{draft.id ? "목표 수정" : "새 목표 추가"}</h2>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <label>
          목표 이름
          <input
            autoFocus
            value={draft.title}
            onChange={(event) =>
              onChange({ ...draft, title: event.target.value })
            }
            maxLength={80}
          />
        </label>
        <fieldset>
          <legend>목표 유형</legend>
          <div className="segmented">
            {(["check", "count", "restraint", "numeric"] as GoalType[]).map(
              (type) => (
                <button
                  key={type}
                  className={draft.goal_type === type ? "selected" : ""}
                  onClick={() => updateType(type)}
                >
                  {goalTypeLabel(type)}
                </button>
              ),
            )}
          </div>
        </fieldset>
        {draft.goal_type === "count" && (
          <label>
            하루 목표 횟수
            <input
              type="number"
              min="2"
              max="999"
              value={draft.target_count}
              onChange={(event) =>
                onChange({
                  ...draft,
                  target_count: Math.max(2, Number(event.target.value)),
                })
              }
            />
          </label>
        )}
        {draft.goal_type === "numeric" && (
          <NumericSettings draft={draft} onChange={onChange} />
        )}
        <fieldset>
          <legend>반복</legend>
          <select
            value={`${schedule.frequency}:${schedule.interval}`}
            onChange={(event) => {
              const [frequency, interval] = event.target.value.split(":");
              onChange({
                ...draft,
                schedule: {
                  ...schedule,
                  frequency: frequency as GoalSchedule["frequency"],
                  interval: Number(interval),
                  days_of_week:
                    frequency === "weekdays"
                      ? (schedule.days_of_week ?? [1])
                      : null,
                  target_count_per_period:
                    frequency === "weekly"
                      ? (schedule.target_count_per_period ?? 1)
                      : null,
                  day_of_month:
                    frequency === "monthly"
                      ? (schedule.day_of_month ?? 1)
                      : null,
                },
              });
            }}
          >
            <option value="daily:1">매일</option>
            <option value="weekdays:1">특정 요일</option>
            <option value="weekdays:2">격주 요일</option>
            <option value="weekly:1">일주일에 N회</option>
            <option value="monthly:1">매월</option>
            <option value="monthly:2">격월</option>
          </select>
          {schedule.frequency === "weekdays" && (
            <div className="weekday-options">
              {["일", "월", "화", "수", "목", "금", "토"].map((day, index) => (
                <button
                  key={day}
                  className={
                    schedule.days_of_week?.includes(index) ? "selected" : ""
                  }
                  onClick={() =>
                    onChange({
                      ...draft,
                      schedule: {
                        ...schedule,
                        days_of_week: schedule.days_of_week?.includes(index)
                          ? schedule.days_of_week.filter(
                              (value) => value !== index,
                            )
                          : [...(schedule.days_of_week ?? []), index],
                      },
                    })
                  }
                >
                  {day}
                </button>
              ))}
            </div>
          )}
          {schedule.frequency === "weekly" && (
            <label>
              주간 목표 횟수
              <input
                type="number"
                min="1"
                max="7"
                value={schedule.target_count_per_period ?? 1}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    schedule: {
                      ...schedule,
                      target_count_per_period: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          )}
          {schedule.frequency === "monthly" && (
            <label>
              기준일
              <input
                type="number"
                min="1"
                max="31"
                value={schedule.day_of_month ?? 1}
                onChange={(event) =>
                  onChange({
                    ...draft,
                    schedule: {
                      ...schedule,
                      day_of_month: Number(event.target.value),
                    },
                  })
                }
              />
            </label>
          )}
        </fieldset>
        <fieldset>
          <legend>아이콘</legend>
          <div className="icon-options">
            {ICONS.map((icon) => (
              <button
                className={draft.icon === icon ? "selected" : ""}
                key={icon}
                onClick={() => onChange({ ...draft, icon })}
              >
                {icon}
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>색상</legend>
          <div className="color-options">
            {COLORS.map((color) => (
              <button
                className={`${color} ${draft.color === color ? "selected" : ""}`}
                key={color}
                onClick={() => onChange({ ...draft, color })}
              />
            ))}
          </div>
        </fieldset>
        <div className="dialog-actions">
          <button onClick={onClose}>취소</button>
          <button
            className="primary-button"
            disabled={!isDraftValid(draft)}
            onClick={onSave}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

function NumericSettings({
  draft,
  onChange,
}: {
  draft: Draft;
  onChange: (draft: Draft) => void;
}) {
  const comparison = draft.comparison ?? "max";
  return (
    <fieldset>
      <legend>수치 달성 기준</legend>
      <select
        value={comparison}
        onChange={(event) =>
          onChange({
            ...draft,
            comparison: event.target.value as NumericComparison,
          })
        }
      >
        <option value="min">최소 이상</option>
        <option value="max">최대 이하</option>
        <option value="range">범위</option>
      </select>
      <div className="numeric-settings">
        {comparison !== "max" && (
          <label>
            최솟값
            <input
              type="number"
              step="any"
              value={draft.min_value ?? ""}
              onChange={(event) =>
                onChange({
                  ...draft,
                  min_value:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
        )}
        {comparison !== "min" && (
          <label>
            최댓값
            <input
              type="number"
              step="any"
              value={draft.max_value ?? ""}
              onChange={(event) =>
                onChange({
                  ...draft,
                  max_value:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
        )}
        <label>
          단위
          <input
            list="goal-units"
            value={draft.unit ?? ""}
            maxLength={12}
            onChange={(event) =>
              onChange({ ...draft, unit: event.target.value })
            }
          />
          <datalist id="goal-units">
            {UNITS.map((unit) => (
              <option key={unit} value={unit} />
            ))}
          </datalist>
        </label>
      </div>
    </fieldset>
  );
}

function toDraft(item: GoalItem): Draft {
  const {
    id,
    title,
    icon,
    color,
    goal_type,
    target_count,
    comparison,
    min_value,
    max_value,
    unit,
    schedule,
  } = item;
  return {
    id,
    title,
    icon: icon ?? "✓",
    color: color ?? "green",
    goal_type,
    target_count,
    comparison,
    min_value,
    max_value,
    unit,
    schedule: schedule ?? {
      frequency: "daily",
      interval: 1,
      days_of_week: null,
      target_count_per_period: null,
      day_of_month: null,
      starts_on: toDateKey(),
      timezone: "Asia/Seoul",
    },
  };
}
function goalTypeLabel(type: GoalType) {
  return { check: "체크", count: "횟수", restraint: "억제", numeric: "수치" }[
    type
  ];
}
function isDraftValid(draft: Draft) {
  if (!draft.title.trim() || !draft.schedule) return false;
  if (
    draft.schedule.frequency === "weekdays" &&
    !draft.schedule.days_of_week?.length
  )
    return false;
  if (draft.goal_type !== "numeric") return true;
  if (!draft.unit?.trim()) return false;
  if (draft.comparison === "min") return draft.min_value !== null;
  if (draft.comparison === "max") return draft.max_value !== null;
  return (
    draft.min_value !== null &&
    draft.max_value !== null &&
    draft.min_value <= draft.max_value
  );
}
function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="empty-state">
      <span>✓</span>
      <h2>이 공간의 첫 목표를 만들어 보세요</h2>
      <p>작은 목표부터 기록할 수 있습니다.</p>
      <button className="primary-button" onClick={onAdd}>
        목표 추가
      </button>
    </div>
  );
}
