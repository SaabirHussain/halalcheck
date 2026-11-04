import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const output = join(homedir(), "halalcheck-shots");
async function signIn(page: Page, email: string, password: string) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
  await expect(page.getByText(/Welcome back/i)).toBeVisible();
}
async function placeHref(page: Page, name: string) {
  await page.goto("/");
  const href = await page.locator(".place-card").evaluateAll((cards, label) => {
    const terms = label.toLowerCase().split(/\s+/);
    const matchingCard = cards.find((card) => {
      const text = (card.textContent ?? "").toLowerCase();
      return terms.every((term) => text.includes(term));
    });
    return matchingCard?.getAttribute("href") ?? null;
  }, name);
  if (!href) throw new Error(`Seeded place not found on discovery: ${name}`);
  return href;
}
async function shot(page: Page, name: string) {
  await page.screenshot({ path: join(output, name), fullPage: true });
}

test("captures requested desktop and mobile UI states", async ({ browser }) => {
  await mkdir(output, { recursive: true });
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await desktop.newPage();
  await page.goto("/");
  await shot(page, "home-list-desktop.png");
  await page.getByRole("button", { name: "Map view" }).click();
  await shot(page, "home-map-desktop.png");
  const mobile = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const mobilePage = await mobile.newPage();
  await mobilePage.goto("/");
  await shot(mobilePage, "home-list-mobile.png");
  await mobilePage.getByRole("button", { name: "Map view" }).click();
  await shot(mobilePage, "home-map-mobile.png");
  await mobilePage.getByRole("button", { name: "List view" }).click();
  await mobilePage.getByRole("button", { name: "Filters" }).click();
  await shot(mobilePage, "filters-sheet-mobile.png");
  for (const [label, filename] of [
    ["Zaytoon Kitchen Downtown", "place-zaytoon-downtown"],
    ["Kebab Corner", "place-kebab-corner"],
    ["Al-Noor Butchers", "place-al-noor-expired"],
    ["Spice Route Grocery", "place-spice-route-unconfirmed"],
  ]) {
    const href = await placeHref(page, label);
    await page.goto(href);
    await shot(page, `${filename}-desktop.png`);
    await mobilePage.goto(href);
    await shot(mobilePage, `${filename}-mobile.png`);
  }
  await page.goto("/sign-in");
  await shot(page, "sign-in-desktop.png");
  await mobilePage.goto("/sign-in");
  await shot(mobilePage, "sign-in-mobile.png");
  await signIn(page, "user@demo.halalcheck.test", "DemoUser!2026");
  await signIn(mobilePage, "user@demo.halalcheck.test", "DemoUser!2026");
  for (const section of ["requests", "notifications"]) {
    await page.goto(`/me/${section}`);
    await shot(page, `me-${section}-desktop.png`);
    await mobilePage.goto(`/me/${section}`);
    await shot(mobilePage, `me-${section}-mobile.png`);
  }
  await page.goto("/admin");
  await shot(page, "admin-forbidden-403-desktop.png");
  await mobilePage.goto("/admin");
  await shot(mobilePage, "admin-forbidden-403-mobile.png");
  await signIn(page, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await signIn(mobilePage, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await page.goto("/admin");
  await shot(page, "admin-overview-desktop.png");
  await mobilePage.goto("/admin");
  await shot(mobilePage, "admin-overview-mobile.png");
  await page.goto("/admin/investigations");
  const saffron = page.locator(".finding").filter({ hasText: "Saffron House" }).first().locator("a");
  if (await saffron.count()) {
    await saffron.click();
    await shot(page, "admin-investigation-saffron-house.png");
  }
  await page.goto("/admin/proposals");
  const kebabProposal = page.locator(".finding").filter({ hasText: "Kebab Corner" }).first().locator("a");
  if (await kebabProposal.count()) {
    await kebabProposal.click();
    await shot(page, "admin-proposal-kebab-corner.png");
  }
  await page.goto("/admin/outreach");
  await shot(page, "admin-outreach-desktop.png");
  await mobilePage.goto("/admin/outreach");
  await shot(mobilePage, "admin-outreach-mobile.png");
  await page.goto("/403");
  await shot(page, "forbidden-403-page.png");
  await desktop.close();

  const offlineContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const offlinePage = await offlineContext.newPage();
  await offlinePage.goto("/");
  await offlineContext.setOffline(true);
  await expect(offlinePage.getByRole("status")).toContainText("offline");
  await shot(offlinePage, "offline-banner-desktop.png");
  await offlineContext.close();
  const geoContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await geoContext.grantPermissions([], { origin: "http://127.0.0.1:3000" });
  const geoPage = await geoContext.newPage();
  await geoPage.goto("/");
  await geoPage.getByRole("button", { name: /Use my location/i }).click();
  await expect(geoPage.getByRole("status")).toContainText("denied");
  await shot(geoPage, "geolocation-denied-mobile.png");
  await geoContext.close();
  await mobile.close();
});
