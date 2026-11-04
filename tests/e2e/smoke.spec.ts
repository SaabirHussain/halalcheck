import { expect, test } from "@playwright/test";

async function signIn(
  page: import("@playwright/test").Page,
  email: string,
  password: string,
) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(
    page.getByText(/Demo Member|Demo Administrator/).first(),
  ).toBeVisible();
}

test("discovery, shared request, access control, and admin outreach review", async ({
  browser,
}) => {
  const userContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const user = await userContext.newPage();
  await user.goto("/");
  await expect(
    user.getByRole("heading", { name: /Know what’s known/i }),
  ).toBeVisible();
  await user.getByRole("button", { name: "Map", exact: true }).click();
  await expect(
    user.getByRole("region", { name: "Map of places" }),
  ).toBeVisible();
  await expect(user.locator(".leaflet-container")).toBeVisible();
  await user.getByRole("button", { name: "List", exact: true }).click();
  const publishedLink = user
    .getByRole("link", { name: /Zaytoon Kitchen, Downtown/i })
    .first();
  const publishedHref = await publishedLink.getAttribute("href");
  await publishedLink.click();
  await expect(
    user.getByRole("heading", { name: "Findings by product" }),
  ).toBeVisible();
  await expect(user.getByRole("heading", { name: "Sources" })).toBeVisible();
  await expect(
    user
      .getByText(/Business email reply|Business website|Certifier registry/i)
      .first(),
  ).toBeVisible();
  await signIn(user, "user@demo.halalcheck.test", "DemoUser!2026");
  await user.goto("/");
  await user
    .getByRole("link", { name: /Cedar Grill/i })
    .first()
    .click();
  const branchId = await user
    .locator('form input[name="branchId"]')
    .first()
    .inputValue();
  await user.getByRole("button", { name: "Request research" }).click();
  await expect(user.getByRole("status")).toContainText(
    /following this investigation/i,
  );

  const second = await browser.newPage();
  await signIn(second, "user2@demo.halalcheck.test", "DemoUser!2026");
  await second.goto(`/places/${branchId}`);
  await second.getByRole("button", { name: /Join investigation/i }).click();
  await expect(
    second
      .getByRole("status")
      .filter({ hasText: /following this investigation/i }),
  ).toBeVisible();
  await user.goto("/admin");
  await expect(user.getByRole("heading", { name: /403/i })).toBeVisible();

  const admin = await browser.newPage();
  await signIn(admin, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await admin.goto("/admin/outreach");
  const draftForm = admin
    .locator("form")
    .filter({ has: admin.getByRole("button", { name: "Approve and send" }) })
    .first();
  await expect(draftForm).toBeVisible({ timeout: 60_000 });
  await draftForm.getByLabel("Approve contact endpoint").check();
  await draftForm.getByRole("button", { name: "Approve and send" }).click();
  await admin.goto("/admin/investigations");
  const investigationLink = admin
    .locator(".finding")
    .filter({ hasText: /Cedar Grill/i })
    .locator(`a[href^="/admin/investigations/"]`)
    .first();
  await investigationLink.click();
  await admin
    .getByRole("button", { name: /Simulate vague business reply/i })
    .click();
  await expect
    .poll(
      async () => {
        await admin.reload();
        return admin
          .getByText(
            /suppliers provide each meat and which organization certifies/i,
          )
          .count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await expect(publishedHref).not.toBeNull();
  await userContext.close();
});
