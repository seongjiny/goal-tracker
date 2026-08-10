import { describe, expect, it } from "vitest";
import { formatKoreanDate, shiftDateKey, toDateKey } from "./date";

describe("Seoul daily date", () => {
  it("UTC 날짜가 달라도 서울 날짜 키를 유지한다", () => {
    expect(toDateKey(new Date("2026-08-09T16:00:00Z"))).toBe("2026-08-10");
  });

  it("월말과 연말을 넘어 날짜를 이동한다", () => {
    expect(shiftDateKey("2026-08-31", 1)).toBe("2026-09-01");
    expect(shiftDateKey("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("한국어 표시 날짜를 만든다", () => {
    expect(formatKoreanDate("2026-08-10")).toContain("8월 10일");
  });
});
