import { describe, expect, it } from "vitest";
import {
  isGoalAchievedForPeriod,
  isGoalScheduledOn,
  isGoalSuccessful,
} from "./domain";
import type { GoalItem, GoalRecord } from "../types";

const item = (values: Partial<GoalItem>): GoalItem => ({
  id: "item",
  household_id: "space",
  created_by: "user",
  title: "목표",
  icon: "✓",
  color: "green",
  sort_order: 0,
  goal_type: "check",
  target_count: 1,
  comparison: null,
  min_value: null,
  max_value: null,
  unit: null,
  archived_at: null,
  created_at: "2026-01-01T00:00:00Z",
  schedule: null,
  ...values,
});
const record = (values: Partial<GoalRecord>): GoalRecord => ({
  id: "record",
  item_id: "item",
  recorded_by: "user",
  record_date: "2026-01-01",
  count: 0,
  status: null,
  numeric_value: null,
  completed_at: null,
  ...values,
});

describe("목표 달성 판정", () => {
  it("횟수 목표를 판정한다", () =>
    expect(
      isGoalSuccessful(
        item({ goal_type: "count", target_count: 3 }),
        record({ count: 3 }),
      ),
    ).toBe(true));
  it("억제 목표는 명시적 성공만 인정한다", () =>
    expect(
      isGoalSuccessful(
        item({ goal_type: "restraint" }),
        record({ status: "success" }),
      ),
    ).toBe(true));
  it("수치 최소·최대·범위를 판정한다", () => {
    expect(
      isGoalSuccessful(
        item({ goal_type: "numeric", comparison: "max", max_value: 4 }),
        record({ numeric_value: 3.5 }),
      ),
    ).toBe(true);
    expect(
      isGoalSuccessful(
        item({
          goal_type: "numeric",
          comparison: "range",
          min_value: 7,
          max_value: 9,
        }),
        record({ numeric_value: 9.5 }),
      ),
    ).toBe(false);
  });
});

describe("반복 일정", () => {
  it("없는 월말 날짜는 마지막 날로 보정한다", () => {
    const monthly = item({
      schedule: {
        frequency: "monthly",
        interval: 1,
        days_of_week: null,
        target_count_per_period: null,
        day_of_month: 31,
        starts_on: "2026-01-01",
        timezone: "Asia/Seoul",
      },
    });
    expect(isGoalScheduledOn(monthly, "2026-02-28")).toBe(true);
  });
  it("격월 간격을 적용한다", () => {
    const bimonthly = item({
      schedule: {
        frequency: "monthly",
        interval: 2,
        days_of_week: null,
        target_count_per_period: null,
        day_of_month: 10,
        starts_on: "2026-01-10",
        timezone: "Asia/Seoul",
      },
    });
    expect(isGoalScheduledOn(bimonthly, "2026-02-10")).toBe(false);
    expect(isGoalScheduledOn(bimonthly, "2026-03-10")).toBe(true);
  });
  it("격주 요일을 시작일 기준으로 판정한다", () => {
    const biweekly = item({
      schedule: {
        frequency: "weekdays",
        interval: 2,
        days_of_week: [1],
        target_count_per_period: null,
        day_of_month: null,
        starts_on: "2026-01-05",
        timezone: "Asia/Seoul",
      },
    });
    expect(isGoalScheduledOn(biweekly, "2026-01-12")).toBe(false);
    expect(isGoalScheduledOn(biweekly, "2026-01-19")).toBe(true);
  });
  it("주 N회는 해당 주의 달성 일수를 센다", () => {
    const weekly = item({
      schedule: {
        frequency: "weekly",
        interval: 1,
        days_of_week: null,
        target_count_per_period: 2,
        day_of_month: null,
        starts_on: "2026-01-01",
        timezone: "Asia/Seoul",
      },
    });
    const records = [
      record({ id: "a", record_date: "2026-01-05", count: 1 }),
      record({ id: "b", record_date: "2026-01-07", count: 1 }),
    ];
    expect(isGoalAchievedForPeriod(weekly, records, "2026-01-08")).toBe(true);
  });
});
