import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(page.getByText(/Welcome back/i)).toBeVisible();
}

test("discovery, shared request, access control, and admin outreach review", async ({ browser }) => {
  const userContext = await browser.newContext();
  const user = await userContext.newPage();
  await user.goto("/");
  await expect(user.getByRole("heading", { name: /Know what’s known/i })).toBeVisible();
  await user.getByRole("button", { name: "Map view" }).click();
  await expect(user.getByRole("img", { name: /Map view/i })).toBeVisible();
  await user.getByRole("button", { name: "List view" }).click();
  const publishedLink = user.locator(".place-card").filter({ hasText: /Zaytoon Kitchen/i }).filter({ hasText: /Downtown/i }).first();
  const publishedHref = await publishedLink.getAttribute("href");
  await publishedLink.click();
  await expect(user.getByRole("heading", { name: "Published findings" })).toBeVisible();
  await expect(user.getByText(/official_website|email_reply|certifier_registry/i).first()).toBeVisible();
  await signIn(user, "user@demo.halalcheck.test", "DemoUser!2026");
  await user.goto("/");
  await user.getByRole("link", { name: /Cedar Grill/i }).first().click();
  const branchId = await user.locator('input[name="branchId"]').inputValue();
  await user.getByRole("button", { name: /Request shared research/i }).click();
  await expect(user).toHaveURL(/\/me\/requests/);

  const second = await browser.newPage();
  await signIn(second, "user2@demo.halalcheck.test", "DemoUser!2026");
  await second.goto(`/places/${branchId}`);
  await second.getByRole("button", { name: /Request shared research/i }).click();
  await expect(second).toHaveURL(/\/me\/requests/);
  await user.goto("/admin");
  await expect(user.getByRole("heading", { name: /403/i })).toBeVisible();

  const admin = await browser.newPage();
  await signIn(admin, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await admin.goto("/admin/outreach");
  const draftForm = admin.locator("form").filter({ has: admin.getByRole("button", { name: "Approve and send" }) }).first();
  await expect(draftForm).toBeVisible({ timeout: 60_000 });
  await draftForm.getByLabel("Approve contact endpoint").check();
  await draftForm.getByRole("button", { name: "Approve and send" }).click();
  await admin.goto("/admin/investigations");
  const investigationLink = admin.locator(".finding").filter({ hasText: /Cedar Grill/i }).locator(`a[href^="/admin/investigations/"]`).first();
  await investigationLink.click();
  await admin.getByRole("button", { name: /Simulate vague business reply/i }).click();
  await expect.poll(async () => {
    await admin.reload();
    return admin.getByText(/suppliers provide each meat and which organization certifies/i).count();
  }, { timeout: 60_000 }).toBeGreaterThan(0);
  await expect(publishedHref).not.toBeNull();
  await userContext.close();
});
