export type SpaceType = "personal" | "shared";
export type GoalType = "check" | "count" | "restraint" | "numeric";
export type NumericComparison = "min" | "max" | "range";
export type RecordStatus = "success" | "failure" | null;
export type ScheduleFrequency = "daily" | "weekdays" | "weekly" | "monthly";

export type Space = {
  id: string;
  name: string;
  invite_code: string;
  space_type: SpaceType;
  personal_owner_id: string | null;
  created_by: string;
  role: "owner" | "member";
  member_count: number;
};

export type GoalSchedule = {
  id?: string;
  item_id?: string;
  frequency: ScheduleFrequency;
  interval: number;
  days_of_week: number[] | null;
  target_count_per_period: number | null;
  day_of_month: number | null;
  starts_on: string;
  timezone: string;
};

export type GoalItem = {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  goal_type: GoalType;
  target_count: number;
  comparison: NumericComparison | null;
  min_value: number | null;
  max_value: number | null;
  unit: string | null;
  archived_at: string | null;
  created_at: string;
  schedule: GoalSchedule | null;
};

export type GoalRecord = {
  id: string;
  item_id: string;
  recorded_by: string;
  record_date: string;
  count: number;
  status: RecordStatus;
  numeric_value: number | null;
  completed_at: string | null;
};

export type GoalItemInput = Omit<GoalItem, "id" | "created_by" | "sort_order" | "archived_at" | "created_at">;
export type GoalRecordInput = Pick<GoalRecord, "item_id" | "record_date" | "count" | "status" | "numeric_value">;
export type AppUser = { id: string; nickname: string; avatarUrl: string | null };

export type WorkspaceData = {
  spaces: Space[];
  items: GoalItem[];
  records: GoalRecord[];
};

// 이전 이름을 import하는 코드와 migration 기간의 호환성을 유지한다.
export type DailyItem = GoalItem;
export type DailyRecord = GoalRecord;
export type Household = Space;
