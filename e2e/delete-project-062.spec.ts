import { expect, test } from "@playwright/test";

test("cancel deletion, then permanently remove one project while leaving another intact", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await page.getByRole("button", { name: "Open Demo Project", exact: true }).click();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await expect(page.locator(".recent-project")).toHaveCount(2);

  const demo = page.locator(".recent-project").filter({ hasText: "FORM · Better by design" });
  await demo.getByRole("button", { name: "Delete project: FORM · Better by design" }).click();
  const dialog = page.getByRole("alertdialog", { name: "Permanently delete this project?" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("cannot be undone");
  await dialog.getByRole("button", { name: "Cancel" }).click();
  await expect(page.locator(".recent-project")).toHaveCount(2);

  await demo.getByRole("button", { name: "Delete project: FORM · Better by design" }).click();
  await dialog.getByRole("button", { name: "Delete permanently" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator(".recent-project")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Open project: Untitled project" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".recent-project")).toHaveCount(1);
  await page.getByRole("button", { name: "Open project: Untitled project" }).click();
  await expect(page.getByTestId("canvas-host")).toBeVisible();
});

test("deletion dialog and project action have Czech translations", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByRole("button", { name: "Back to projects" }).click();
  await page.getByRole("button", { name: "Switch to Czech" }).click();
  await page.getByRole("button", { name: /Smazat projekt: / }).click();
  await expect(page.getByRole("alertdialog", { name: "Trvale smazat tento projekt?" })).toBeVisible();
});
