import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
}

async function openCedarGrill(page: Page) {
  await page.goto("/");
  const cedar = page.getByRole("link", { name: /Cedar Grill/i }).first();
  await expect(cedar).toBeVisible();
  await cedar.click();
}

test("discovery and evidence-backed Cedar Grill publication workflow", async ({
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
  await expect(user.locator(".leaflet-container")).toBeVisible();
  await user.getByRole("button", { name: "List", exact: true }).click();
  const zaytoon = user
    .getByRole("link", { name: /Zaytoon Kitchen, Downtown/i })
    .first();
  await expect(zaytoon).toBeVisible();
  await zaytoon.click();
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
  await openCedarGrill(user);
  const branchId = await user
    .locator('form input[name="branchId"]')
    .first()
    .inputValue();
  await user.getByRole("button", { name: "Request research" }).click();
  await expect(user.getByRole("status")).toContainText(
    /following this investigation/i,
  );

  const deniedUser = await browser.newPage();
  await signIn(deniedUser, "user2@demo.halalcheck.test", "DemoUser!2026");
  await deniedUser.goto("/admin");
  await expect(deniedUser.getByRole("heading", { name: /403/i })).toBeVisible();

  const admin = await browser.newPage();
  await signIn(admin, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await admin.goto("/admin/outreach");
  await admin.getByLabel("Minimum days between messages").fill("0");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await admin.goto("/admin/investigations");
  const investigationLink = admin
    .getByRole("link", { name: /Cedar Grill/i })
    .first();
  await expect(investigationLink).toBeVisible({ timeout: 60_000 });
  const investigationHref = await investigationLink.getAttribute("href");
  if (!investigationHref) throw new Error("Investigation link is missing.");

  await admin.goto("/admin/outreach");
  const cedarDraft = admin
    .locator("article")
    .filter({ hasText: /Cedar Grill/i });
  await expect(cedarDraft.first()).toBeVisible({ timeout: 60_000 });
  const approveForm = cedarDraft
    .locator("form")
    .filter({ has: admin.getByRole("button", { name: "Approve draft" }) })
    .first();
  await approveForm.getByLabel("Also approve contact").check();
  await approveForm.getByRole("button", { name: "Approve draft" }).click();

  await admin.goto(investigationHref);
  const initialMessage = admin
    .locator("article")
    .filter({ hasText: /Initial message · #1/ })
    .first();
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await initialMessage.locator("p").first().textContent()) ?? "";
      },
      { timeout: 30_000 },
    )
    .toMatch(/Captured \(not sent\)|· Sent$/);
  const replyPreset = admin.getByLabel("Preset");
  await replyPreset.selectOption("vague");
  await expect(admin.getByLabel("Editable reply")).toHaveValue(
    "All our meat is halal.",
  );
  await admin.getByRole("button", { name: "Simulate reply" }).click();
  await expect(admin).toHaveURL(/simulated=[0-9a-f-]{36}/);
  const firstSimulationUrl = admin.url();
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await admin.getByRole("status").textContent()) ?? "";
      },
      { timeout: 60_000 },
    )
    .toContain("Reply parsed. A follow-up draft is ready for review.");

  const targetedFollowup = /which suppliers provide each meat/i;
  await expect
    .poll(
      async () => {
        await admin.reload();
        return admin
          .locator("article")
          .filter({ hasText: targetedFollowup })
          .count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  const followupDraft = admin
    .locator("article")
    .filter({ hasText: targetedFollowup });
  await followupDraft.getByRole("button", { name: "Approve" }).click();
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await followupDraft.locator("p").first().textContent()) ?? "";
      },
      { timeout: 30_000 },
    )
    .toMatch(/Captured \(not sent\)|· Sent$/);

  await admin.getByLabel("Preset").selectOption("clarification");
  await expect(admin.getByLabel("Editable reply")).toHaveValue(
    /Green Valley Poultry/,
  );
  await admin.getByRole("button", { name: "Simulate reply" }).click();
  await expect(admin).toHaveURL(/simulated=[0-9a-f-]{36}/);
  await expect(admin).not.toHaveURL(firstSimulationUrl);
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await admin.getByRole("status").textContent()) ?? "";
      },
      { timeout: 60_000 },
    )
    .toContain("Reply parsed. A follow-up draft is ready for review.");

  const finalFollowup = admin
    .locator("article")
    .filter({ hasText: /Follow-up message · #3/ })
    .last();
  await expect(
    finalFollowup.getByRole("button", { name: "Approve" }),
  ).toBeVisible();
  await finalFollowup.getByRole("button", { name: "Approve" }).click();
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await finalFollowup.locator("p").first().textContent()) ?? "";
      },
      { timeout: 30_000 },
    )
    .toMatch(/Captured \(not sent\)|· Sent$/);

  await admin.getByLabel("Preset").selectOption("staff");
  await expect(admin.getByLabel("Editable reply")).toHaveValue(
    "Our staff don't know.",
  );
  await admin.getByRole("button", { name: "Simulate reply" }).click();
  await expect(admin).toHaveURL(/simulated=[0-9a-f-]{36}/);
  await expect
    .poll(
      async () => {
        await admin.reload();
        return (await admin.getByRole("status").textContent()) ?? "";
      },
      { timeout: 60_000 },
    )
    .toContain("Reply parsed. A proposal is ready for review.");

  await expect
    .poll(
      async () => {
        await admin.goto(investigationHref);
        return admin.getByRole("link", { name: /review proposal/i }).count();
      },
      { timeout: 60_000 },
    )
    .toBeGreaterThan(0);
  await admin.getByRole("link", { name: /review proposal/i }).click();
  await admin.waitForLoadState("networkidle");
  const proposedFindings = admin
    .getByRole("heading", { name: "Currently published vs proposed" })
    .locator("..");
  const chickenSupplier = proposedFindings
    .locator("article")
    .filter({ hasText: /Chicken\s*·\s*Supplier/i })
    .filter({ hasText: "Green Valley Poultry" });
  await expect(chickenSupplier).toHaveCount(1);
  const beefSupplier = proposedFindings
    .locator("article")
    .filter({ hasText: /Beef\s*·\s*Supplier/i })
    .filter({ hasText: "Prairie Meats" });
  await expect(beefSupplier).toHaveCount(1);
  await expect(
    proposedFindings
      .locator("article")
      .filter({ hasText: /Lamb\s*·\s*Supplier/i }),
  ).toHaveCount(0);
  const decisionGroups = admin.locator("fieldset");
  for (let index = 0; index < (await decisionGroups.count()); index += 1) {
    const group = decisionGroups.nth(index);
    const legend = (await group.locator("legend").textContent()) ?? "";
    const decision = /Chicken\s*·\s*Supplier:\s*Cedar Valley Poultry/i.test(
      legend,
    )
      ? "Reject"
      : "Approve";
    const selection = group.getByRole("radio", { name: decision });
    await selection.check();
    await expect(selection).toBeChecked();
  }
  const materialConfirmations = admin.locator(
    'input[name="materialChangeConfirmed"]',
  );
  for (
    let index = 0;
    index < (await materialConfirmations.count());
    index += 1
  ) {
    await materialConfirmations.nth(index).check();
  }
  const publishButton = admin.getByRole("button", {
    name: "Publish approved findings",
  });
  const publishForm = admin.locator("form").filter({ has: publishButton });
  const invalidControls = await publishForm.evaluate((form) =>
    Array.from(form.querySelectorAll("input, textarea, select, button"))
      .filter((control) =>
        control instanceof HTMLInputElement ||
        control instanceof HTMLTextAreaElement ||
        control instanceof HTMLSelectElement ||
        control instanceof HTMLButtonElement
          ? !control.checkValidity()
          : false,
      )
      .map((control) => ({
        name: control.getAttribute("name"),
        type: control.getAttribute("type"),
        value:
          control instanceof HTMLInputElement ||
          control instanceof HTMLTextAreaElement
            ? control.value
            : "",
      })),
  );
  expect(invalidControls).toEqual([]);
  await publishButton.click();
  await expect(admin).toHaveURL(new RegExp(`/places/${branchId}$`));

  const anonymous = await browser.newPage();
  await anonymous.goto(`/places/${branchId}`);
  await expect(
    anonymous.getByText("Green Valley Poultry").first(),
  ).toBeVisible();
  await expect(
    anonymous.getByText(/Restaurant reports/i).first(),
  ).toBeVisible();

  await expect
    .poll(
      async () => {
        await user.goto("/me/notifications");
        return user.getByText(/Cedar Grill/i).count();
      },
      {
        timeout: 60_000,
      },
    )
    .toBeGreaterThan(0);
  await user.goto("/me/requests");
  const cedarRequest = user
    .locator("article")
    .filter({ hasText: /Cedar Grill/i });
  await expect(cedarRequest).toContainText("Findings have been published");
  await expect(cedarRequest).not.toContainText("awaits administrator review");

  await Promise.all([
    userContext.close(),
    deniedUser.context().close(),
    admin.context().close(),
    anonymous.context().close(),
  ]);
});
