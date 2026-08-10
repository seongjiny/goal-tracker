export type DailyItem = {
  id: string;
  household_id: string;
  created_by: string;
  title: string;
  icon: string | null;
  color: string | null;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
};

export type DailyRecord = {
  id: string;
  item_id: string;
  recorded_by: string;
  record_date: string;
  count: number;
  completed_at: string | null;
};

export type Household = { id: string; name: string; invite_code: string };
export type AppUser = { id: string; nickname: string; avatarUrl: string | null };
