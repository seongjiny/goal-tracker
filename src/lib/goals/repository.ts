import { createClient } from "@/lib/supabase/client";
import { shiftDateKey, toDateKey } from "@/lib/date";
import type {
  GoalItem,
  GoalItemInput,
  GoalRecord,
  GoalRecordInput,
  GoalSchedule,
  Space,
  WorkspaceData,
} from "@/lib/types";

export interface GoalRepository {
  load(): Promise<WorkspaceData>;
  saveItem(input: GoalItemInput, id?: string): Promise<GoalItem>;
  setRecord(input: GoalRecordInput): Promise<GoalRecord | null>;
  archiveItem(itemId: string, archived: boolean): Promise<void>;
  reorderItems(itemIds: string[]): Promise<void>;
  createSharedSpace(name: string): Promise<void>;
  joinSharedSpace(code: string): Promise<void>;
  leaveSharedSpace(spaceId: string): Promise<void>;
}

function normalizeItem(
  row: Record<string, unknown>,
  schedules: GoalSchedule[],
): GoalItem {
  return {
    ...(row as unknown as Omit<GoalItem, "schedule">),
    target_count: Number(row.target_count ?? 1),
    min_value:
      row.min_value === null || row.min_value === undefined
        ? null
        : Number(row.min_value),
    max_value:
      row.max_value === null || row.max_value === undefined
        ? null
        : Number(row.max_value),
    schedule: schedules.find((schedule) => schedule.item_id === row.id) ?? null,
  };
}

export class SupabaseGoalRepository implements GoalRepository {
  constructor(private readonly userId: string) {}

  async load(): Promise<WorkspaceData> {
    const supabase = createClient();
    const start = shiftDateKey(toDateKey(), -370);
    const [
      { data: memberships, error: membershipError },
      { data: memberRows },
      { data: itemRows, error: itemError },
      { data: recordRows, error: recordError },
      { data: schedules },
    ] = await Promise.all([
      supabase
        .from("household_members")
        .select(
          "role, households!inner(id,name,invite_code,space_type,personal_owner_id,created_by)",
        )
        .eq("user_id", this.userId),
      supabase.from("household_members").select("household_id,user_id"),
      supabase.from("daily_items").select("*").order("sort_order"),
      supabase
        .from("daily_records")
        .select("*")
        .gte("record_date", start)
        .lte("record_date", toDateKey()),
      supabase.from("goal_schedules").select("*"),
    ]);
    if (membershipError || itemError || recordError)
      throw new Error("목표 데이터를 불러오지 못했습니다.");

    const spaces = (memberships ?? [])
      .map((membership) => {
        const space = membership.households as unknown as Omit<
          Space,
          "role" | "member_count"
        >;
        return {
          ...space,
          role: membership.role,
          member_count: (memberRows ?? []).filter(
            (row) => row.household_id === space.id,
          ).length,
        } as Space;
      })
      .sort((a, b) =>
        a.space_type === b.space_type
          ? 0
          : a.space_type === "personal"
            ? -1
            : 1,
      );
    const scheduleRows = (schedules ?? []) as GoalSchedule[];
    return {
      spaces,
      items: (itemRows ?? []).map((row) => normalizeItem(row, scheduleRows)),
      records: (recordRows ?? []).map((row) => ({
        ...row,
        count: Number(row.count),
        numeric_value:
          row.numeric_value === null ? null : Number(row.numeric_value),
      })) as GoalRecord[],
    };
  }

  async saveItem(input: GoalItemInput, id?: string) {
    const supabase = createClient();
    const { schedule, ...itemInput } = input;
    const normalized = { ...itemInput, unit: itemInput.unit?.trim() || null };
    let saved: Record<string, unknown>;
    if (id) {
      const { data, error } = await supabase
        .from("daily_items")
        .update(normalized)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error("목표 수정에 실패했습니다.");
      saved = data;
    } else {
      const { count } = await supabase
        .from("daily_items")
        .select("id", { count: "exact", head: true })
        .eq("household_id", input.household_id)
        .is("archived_at", null);
      const { data, error } = await supabase
        .from("daily_items")
        .insert({
          ...normalized,
          created_by: this.userId,
          sort_order: count ?? 0,
        })
        .select()
        .single();
      if (error) throw new Error("목표 추가에 실패했습니다.");
      saved = data;
      id = data.id;
    }

    if (schedule) {
      const { error } = await supabase
        .from("goal_schedules")
        .upsert({ ...schedule, item_id: id }, { onConflict: "item_id" });
      if (error) throw new Error("반복 일정 저장에 실패했습니다.");
    } else if (id) {
      const { error } = await supabase
        .from("goal_schedules")
        .delete()
        .eq("item_id", id);
      if (error) throw new Error("반복 일정 변경에 실패했습니다.");
    }
    return normalizeItem(saved, schedule ? [{ ...schedule, item_id: id }] : []);
  }

  async setRecord(input: GoalRecordInput) {
    const supabase = createClient();
    if (
      input.count === 0 &&
      input.status === null &&
      input.numeric_value === null
    ) {
      const { error } = await supabase
        .from("daily_records")
        .delete()
        .eq("item_id", input.item_id)
        .eq("recorded_by", this.userId)
        .eq("record_date", input.record_date);
      if (error) throw new Error("기록 삭제에 실패했습니다.");
      return null;
    }
    const completed =
      input.status === "failure" ? null : new Date().toISOString();
    const { data, error } = await supabase
      .from("daily_records")
      .upsert(
        { ...input, recorded_by: this.userId, completed_at: completed },
        { onConflict: "item_id,recorded_by,record_date" },
      )
      .select()
      .single();
    if (error) throw new Error("기록 저장에 실패했습니다.");
    return {
      ...data,
      count: Number(data.count),
      numeric_value:
        data.numeric_value === null ? null : Number(data.numeric_value),
    } as GoalRecord;
  }

  async archiveItem(itemId: string, archived: boolean) {
    const { error } = await createClient()
      .from("daily_items")
      .update({ archived_at: archived ? new Date().toISOString() : null })
      .eq("id", itemId);
    if (error) throw new Error("목표 상태 변경에 실패했습니다.");
  }

  async reorderItems(itemIds: string[]) {
    const supabase = createClient();
    const results = await Promise.all(
      itemIds.map((id, sort_order) =>
        supabase.from("daily_items").update({ sort_order }).eq("id", id),
      ),
    );
    if (results.some(({ error }) => error))
      throw new Error("목표 순서 저장에 실패했습니다.");
  }

  async createSharedSpace(name: string) {
    const { error } = await createClient().rpc("create_shared_space", {
      space_name: name.trim() || "우리 공간",
    });
    if (error) throw new Error("우리 공간 생성에 실패했습니다.");
  }
  async joinSharedSpace(code: string) {
    const { error } = await createClient().rpc("join_shared_space", {
      code: code.trim(),
    });
    if (error) throw new Error("초대 코드를 확인해 주세요.");
  }
  async leaveSharedSpace(spaceId: string) {
    const { error } = await createClient().rpc("leave_shared_space", {
      target_space_id: spaceId,
    });
    if (error)
      throw new Error(
        error.message.includes("LAST_MEMBER")
          ? "마지막 구성원은 공간을 나갈 수 없습니다."
          : "우리 공간 나가기에 실패했습니다.",
      );
  }
}

type DemoStore = WorkspaceData;
const DEMO_KEY = "goal-tracker-demo-v3";

export class LocalGoalRepository implements GoalRepository {
  constructor(private readonly userId: string) {}
  private read(): DemoStore {
    const raw = localStorage.getItem(DEMO_KEY);
    if (raw) return JSON.parse(raw) as DemoStore;
    const personal: Space = {
      id: "personal",
      name: "내 공간",
      invite_code: "",
      space_type: "personal",
      personal_owner_id: this.userId,
      created_by: this.userId,
      role: "owner",
      member_count: 1,
    };
    const items: GoalItem[] = [
      {
        id: "vitamin",
        household_id: personal.id,
        created_by: this.userId,
        title: "영양제 먹기",
        icon: "💊",
        color: "green",
        sort_order: 0,
        goal_type: "check",
        target_count: 1,
        comparison: null,
        min_value: null,
        max_value: null,
        unit: null,
        archived_at: null,
        created_at: new Date().toISOString(),
        schedule: null,
      },
      {
        id: "water",
        household_id: personal.id,
        created_by: this.userId,
        title: "물 마시기",
        icon: "💧",
        color: "sky",
        sort_order: 1,
        goal_type: "count",
        target_count: 8,
        comparison: null,
        min_value: null,
        max_value: null,
        unit: "잔",
        archived_at: null,
        created_at: new Date().toISOString(),
        schedule: null,
      },
      {
        id: "phone",
        household_id: personal.id,
        created_by: this.userId,
        title: "휴대폰 4시간 이하",
        icon: "📱",
        color: "purple",
        sort_order: 2,
        goal_type: "numeric",
        target_count: 1,
        comparison: "max",
        min_value: null,
        max_value: 4,
        unit: "시간",
        archived_at: null,
        created_at: new Date().toISOString(),
        schedule: null,
      },
    ];
    const store = { spaces: [personal], items, records: [] };
    this.write(store);
    return store;
  }
  private write(store: DemoStore) {
    localStorage.setItem(DEMO_KEY, JSON.stringify(store));
  }
  async load() {
    return structuredClone(this.read());
  }
  async saveItem(input: GoalItemInput, id?: string) {
    const store = this.read();
    let item: GoalItem;
    if (id) {
      item = { ...store.items.find((current) => current.id === id)!, ...input };
      store.items = store.items.map((current) =>
        current.id === id ? item : current,
      );
    } else {
      item = {
        ...input,
        id: crypto.randomUUID(),
        created_by: this.userId,
        sort_order: store.items.filter(
          (current) =>
            current.household_id === input.household_id && !current.archived_at,
        ).length,
        archived_at: null,
        created_at: new Date().toISOString(),
      };
      store.items.push(item);
    }
    this.write(store);
    return item;
  }
  async setRecord(input: GoalRecordInput) {
    const store = this.read();
    store.records = store.records.filter(
      (record) =>
        !(
          record.item_id === input.item_id &&
          record.recorded_by === this.userId &&
          record.record_date === input.record_date
        ),
    );
    if (
      input.count === 0 &&
      input.status === null &&
      input.numeric_value === null
    ) {
      this.write(store);
      return null;
    }
    const record: GoalRecord = {
      ...input,
      id: crypto.randomUUID(),
      recorded_by: this.userId,
      completed_at:
        input.status === "failure" ? null : new Date().toISOString(),
    };
    store.records.push(record);
    this.write(store);
    return record;
  }
  async archiveItem(itemId: string, archived: boolean) {
    const store = this.read();
    store.items = store.items.map((item) =>
      item.id === itemId
        ? { ...item, archived_at: archived ? new Date().toISOString() : null }
        : item,
    );
    this.write(store);
  }
  async reorderItems(itemIds: string[]) {
    const store = this.read();
    store.items = store.items.map((item) =>
      itemIds.includes(item.id)
        ? { ...item, sort_order: itemIds.indexOf(item.id) }
        : item,
    );
    this.write(store);
  }
  async createSharedSpace(name: string) {
    const store = this.read();
    store.spaces.push({
      id: crypto.randomUUID(),
      name: name.trim() || "우리 공간",
      invite_code: "DEMO2026",
      space_type: "shared",
      personal_owner_id: null,
      created_by: this.userId,
      role: "owner",
      member_count: 1,
    });
    this.write(store);
  }
  async joinSharedSpace() {
    throw new Error("미리보기에서는 초대 참여를 테스트할 수 없습니다.");
  }
  async leaveSharedSpace(spaceId: string) {
    const store = this.read();
    store.spaces = store.spaces.filter((space) => space.id !== spaceId);
    this.write(store);
  }
}
