import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/?demo=1");
  await page.evaluate(() => localStorage.removeItem("goal-tracker-demo-v3"));
  await page.reload();
});

test("체크·횟수·수치 목표를 기록하고 진행률을 계산한다", async ({ page }) => {
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await page.getByRole("button", { name: "＋", exact: true }).click();
  await page.getByLabel("휴대폰 4시간 이하 측정값").fill("3.5");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("2 / 3 달성")).toBeVisible();
  await expect(page.getByText("3.5시간", { exact: false })).toBeVisible();
});

test("억제 목표와 반복 요일을 만들고 보관·복원한다", async ({ page }) => {
  await page.getByRole("button", { name: /목표 관리/ }).click();
  await page.getByRole("button", { name: "＋ 새 목표 추가" }).click();
  await page.getByLabel("목표 이름").fill("야식 먹지 않기");
  await page.getByRole("button", { name: "억제", exact: true }).click();
  await page.locator(".item-dialog select").first().selectOption("weekdays:1");
  await page.getByRole("button", { name: "수", exact: true }).click();
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByText("야식 먹지 않기")).toBeVisible();
  await page
    .locator(".manage-row")
    .filter({ hasText: "야식 먹지 않기" })
    .getByRole("button", { name: "보관" })
    .click();
  await page.getByRole("button", { name: "보관함" }).click();
  await expect(page.getByText("야식 먹지 않기")).toBeVisible();
  await page
    .locator(".archive-row")
    .filter({ hasText: "야식 먹지 않기" })
    .getByRole("button", { name: "복원" })
    .click();
});

test("우리 공간을 만들어도 개인 목표가 개인 공간에 남는다", async ({
  page,
}) => {
  await page.getByRole("button", { name: "＋ 우리 공간" }).click();
  await page.getByRole("button", { name: "우리 공간 만들기" }).click();
  await page.goBack();
  await page.getByRole("button", { name: "우리 공간", exact: true }).click();
  await expect(
    page.getByText("이 공간의 첫 목표를 만들어 보세요"),
  ).toBeVisible();
  await page.getByRole("button", { name: "내 공간", exact: true }).click();
  await expect(page.getByText("영양제 먹기")).toBeVisible();
});

test("목표 카드를 드래그해 순서를 저장한다", async ({ page }) => {
  await page.getByRole("button", { name: /목표 관리/ }).click();
  const rows = page.locator(".manage-row");
  await rows.nth(0).dragTo(rows.nth(2));
  await expect(rows.nth(0)).toContainText("물 마시기");
  await page.reload();
  await page.getByRole("button", { name: /목표 관리/ }).click();
  await expect(page.locator(".manage-row").nth(0)).toContainText("물 마시기");
  await expect(page.getByRole("button", { name: "↑" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "↓" })).toHaveCount(0);
});
