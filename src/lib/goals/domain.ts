import { shiftDateKey } from "../date";
import type { GoalItem, GoalRecord } from "../types";

export function isGoalSuccessful(item: GoalItem, record?: GoalRecord) {
  if (!record) return false;
  if (item.goal_type === "restraint") return record.status === "success";
  if (item.goal_type === "numeric") {
    const value = record.numeric_value;
    if (value === null) return false;
    if (item.comparison === "min")
      return item.min_value !== null && value >= item.min_value;
    if (item.comparison === "max")
      return item.max_value !== null && value <= item.max_value;
    return (
      item.min_value !== null &&
      item.max_value !== null &&
      value >= item.min_value &&
      value <= item.max_value
    );
  }
  return record.count >= item.target_count;
}

export function isGoalScheduledOn(item: GoalItem, dateKey: string) {
  const schedule = item.schedule;
  if (!schedule) return true;
  if (dateKey < schedule.starts_on) return false;
  if (schedule.frequency === "daily" || schedule.frequency === "weekly")
    return true;

  const date = new Date(`${dateKey}T12:00:00Z`);
  if (schedule.frequency === "weekdays") {
    if (!(schedule.days_of_week ?? []).includes(date.getUTCDay())) return false;
    const start = new Date(`${schedule.starts_on}T12:00:00Z`);
    const elapsedWeeks = Math.floor(
      (date.getTime() - start.getTime()) / (7 * 86_400_000),
    );
    return elapsedWeeks >= 0 && elapsedWeeks % schedule.interval === 0;
  }

  const day = date.getUTCDate();
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const scheduledDay = Math.min(schedule.day_of_month ?? 1, lastDay);
  if (day !== scheduledDay) return false;

  const start = new Date(`${schedule.starts_on}T12:00:00Z`);
  const months =
    (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    date.getUTCMonth() -
    start.getUTCMonth();
  return months >= 0 && months % schedule.interval === 0;
}

export function isGoalAchievedForPeriod(
  item: GoalItem,
  records: GoalRecord[],
  dateKey: string,
) {
  if (item.schedule?.frequency !== "weekly") {
    return isGoalSuccessful(
      item,
      records.find(
        (record) =>
          record.item_id === item.id && record.record_date === dateKey,
      ),
    );
  }
  const progress = getWeeklyProgress(item, records, dateKey);
  return Boolean(progress && progress.count >= progress.target);
}

export function getWeeklyProgress(
  item: GoalItem,
  records: GoalRecord[],
  dateKey: string,
) {
  if (item.schedule?.frequency !== "weekly") return null;
  const date = new Date(`${dateKey}T12:00:00Z`);
  const weekday = date.getUTCDay() || 7;
  const monday = shiftDateKey(dateKey, 1 - weekday);
  const sunday = shiftDateKey(monday, 6);
  const count = new Set(
    records
      .filter(
        (record) =>
          record.item_id === item.id &&
          record.record_date >= monday &&
          record.record_date <= sunday &&
          isGoalSuccessful(item, record),
      )
      .map((record) => record.record_date),
  ).size;
  return { count, target: item.schedule.target_count_per_period ?? 1 };
}

export function getStreak(
  item: GoalItem,
  records: GoalRecord[],
  today: string,
) {
  const successfulDates = new Set(
    records
      .filter(
        (record) =>
          record.item_id === item.id && isGoalSuccessful(item, record),
      )
      .map((record) => record.record_date),
  );
  let count = 0;
  let cursor = today;
  while (successfulDates.has(cursor)) {
    count += 1;
    cursor = shiftDateKey(cursor, -1);
  }
  return count;
}

export function getGoalProgressLabel(item: GoalItem, record?: GoalRecord) {
  if (item.goal_type === "numeric")
    return record?.numeric_value === null || record?.numeric_value === undefined
      ? "값 입력"
      : `${record.numeric_value}${item.unit ?? ""}`;
  if (item.goal_type === "restraint")
    return record?.status === "success"
      ? "지킴"
      : record?.status === "failure"
        ? "실패"
        : "기록 전";
  if (item.goal_type === "count")
    return `${record?.count ?? 0} / ${item.target_count}`;
  return isGoalSuccessful(item, record) ? "완료" : "미완료";
}
