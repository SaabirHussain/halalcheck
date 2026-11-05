import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const output = join(homedir(), "halalcheck-shots");

async function openWithoutDevOverlay(page: Page, path: string) {
  await page.goto(path);
  await page.evaluate(() => {
    const removeOverlay = () => {
      document
        .querySelectorAll("nextjs-portal")
        .forEach((portal) => portal.remove());
    };
    removeOverlay();
    new MutationObserver(removeOverlay).observe(document.body, {
      childList: true,
      subtree: true,
    });
  });
}

async function waitForRenderedMap(page: Page) {
  const map = page.locator(".leaflet-container");
  await expect(map).toBeVisible();
  await expect(map.locator(".leaflet-control-attribution")).toContainText(
    "OpenStreetMap",
  );
  await expect(map.locator(".leaflet-interactive").first()).toBeVisible();
  await page.waitForFunction(
    () => {
      const tiles = Array.from(
        document.querySelectorAll<HTMLImageElement>(".leaflet-tile"),
      );
      return (
        tiles.length > 0 &&
        tiles.every((tile) => tile.complete && tile.naturalWidth > 0)
      );
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForTimeout(500);
}

async function signIn(page: Page, email: string, password: string) {
  await openWithoutDevOverlay(page, "/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://127.0.0.1:3000/");
}

async function placeHref(page: Page, name: RegExp) {
  await openWithoutDevOverlay(page, "/");
  const link = page.getByRole("link", { name });
  await expect(link.first()).toBeVisible();
  return link.first().getAttribute("href");
}

async function shot(page: Page, name: string, fullPage = true) {
  const width = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    viewportWidth: window.innerWidth,
  }));
  expect(
    width.scrollWidth,
    `${name}: document width should fit the ${width.viewportWidth}px viewport`,
  ).toBeLessThanOrEqual(width.viewportWidth);
  await page.screenshot({
    animations: "disabled",
    fullPage,
    path: join(output, name),
  });
}

test("captures the requested public discovery and place screens", async ({
  browser,
}) => {
  await mkdir(output, { recursive: true });
  const desktop = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktop.newPage();
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const mobilePage = await mobile.newPage();

  await openWithoutDevOverlay(desktopPage, "/");
  await waitForRenderedMap(desktopPage);
  await shot(desktopPage, "home-list-desktop.png", false);
  await shot(desktopPage, "home-map-desktop.png", false);

  await openWithoutDevOverlay(mobilePage, "/");
  await shot(mobilePage, "home-list-mobile.png", false);
  await mobilePage.getByRole("button", { name: "Map", exact: true }).click();
  await waitForRenderedMap(mobilePage);
  await shot(mobilePage, "home-map-mobile.png", false);
  await mobilePage.getByRole("button", { name: "List", exact: true }).click();
  await mobilePage.getByRole("button", { name: /^Filters/ }).click();
  await expect(
    mobilePage.getByRole("dialog", { name: "Discovery filters" }),
  ).toBeVisible();
  await shot(mobilePage, "filters-sheet-mobile.png", false);

  const geoContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  await geoContext.grantPermissions([], {
    origin: "http://127.0.0.1:3000",
  });
  const geoPage = await geoContext.newPage();
  await openWithoutDevOverlay(geoPage, "/");
  await geoPage.getByRole("button", { name: /Use my location/i }).click();
  await expect(geoPage.getByRole("status")).toContainText("denied");
  await shot(geoPage, "geolocation-denied-mobile.png", false);
  await geoContext.close();

  await openWithoutDevOverlay(desktopPage, "/sign-in");
  await shot(desktopPage, "sign-in-desktop.png");
  await openWithoutDevOverlay(mobilePage, "/sign-in");
  await shot(mobilePage, "sign-in-mobile.png");
  await signIn(desktopPage, "user@demo.halalcheck.test", "DemoUser!2026");
  await signIn(mobilePage, "user@demo.halalcheck.test", "DemoUser!2026");

  for (const [page, suffix] of [
    [desktopPage, "desktop"],
    [mobilePage, "mobile"],
  ] as const) {
    for (const section of ["requests", "notifications", "settings"] as const) {
      await openWithoutDevOverlay(page, `/me/${section}`);
      await shot(page, `me-${section}-${suffix}.png`);
    }
  }
  await openWithoutDevOverlay(desktopPage, "/me/saved");
  await shot(desktopPage, "me-saved-desktop.png");
  await openWithoutDevOverlay(mobilePage, "/me/saved");
  await shot(mobilePage, "me-saved-mobile.png");

  const cedarHref = await placeHref(desktopPage, /Cedar Grill/i);
  if (!cedarHref) throw new Error("Could not find seeded place: Cedar Grill");
  await openWithoutDevOverlay(desktopPage, `${cedarHref}/report`);
  await shot(desktopPage, "report-form-desktop.png");
  const mobileCedarHref = await placeHref(mobilePage, /Cedar Grill/i);
  if (!mobileCedarHref)
    throw new Error("Could not find seeded place: Cedar Grill");
  await openWithoutDevOverlay(mobilePage, `${mobileCedarHref}/report`);
  await shot(mobilePage, "report-form-mobile.png");

  const signedInPlaces = [
    [/Zaytoon Kitchen, Downtown/i, "place-zaytoon-downtown"],
    [/Kebab Corner/i, "place-kebab-corner"],
    [/Al-Noor Butchers/i, "place-al-noor"],
    [/Spice Route Grocery/i, "place-spice-route"],
    [/Saffron House/i, "place-saffron-house"],
  ] as const;

  for (const [label, filename] of signedInPlaces) {
    const href = await placeHref(desktopPage, label);
    if (!href) throw new Error(`Could not find seeded place: ${label}`);
    await openWithoutDevOverlay(desktopPage, href);
    await waitForRenderedMap(desktopPage);
    await shot(desktopPage, `${filename}-desktop.png`);
    await openWithoutDevOverlay(mobilePage, href);
    await waitForRenderedMap(mobilePage);
    await shot(mobilePage, `${filename}-mobile.png`);
  }

  for (const [page, filename] of [
    [desktopPage, "admin-forbidden-403-desktop.png"],
    [mobilePage, "admin-forbidden-403-mobile.png"],
  ] as const) {
    await openWithoutDevOverlay(page, "/admin");
    await expect(page.getByRole("heading", { name: /403/i })).toBeVisible();
    await shot(page, filename);
  }

  const adminDesktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const adminMobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const adminDesktop = await adminDesktopContext.newPage();
  const adminMobile = await adminMobileContext.newPage();
  await signIn(adminDesktop, "admin@demo.halalcheck.test", "DemoAdmin!2026");
  await signIn(adminMobile, "admin@demo.halalcheck.test", "DemoAdmin!2026");

  for (const route of [
    "/admin/investigations",
    "/admin/proposals",
    "/admin/certificates",
    "/admin/corrections",
    "/admin/refresh",
    "/admin/corrections/00000000-0000-4000-8000-000000000000",
  ]) {
    await openWithoutDevOverlay(adminMobile, route);
    const width = await adminMobile.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
    }));
    expect(
      width.scrollWidth,
      `${route} should fit at mobile width`,
    ).toBeLessThanOrEqual(width.viewportWidth);
  }

  for (const [page, suffix] of [
    [adminDesktop, "desktop"],
    [adminMobile, "mobile"],
  ] as const) {
    await openWithoutDevOverlay(page, "/admin");
    await shot(page, `admin-overview-${suffix}.png`);
    await openWithoutDevOverlay(page, "/admin/outreach");
    await shot(page, `admin-outreach-${suffix}.png`);
    await openWithoutDevOverlay(page, "/admin/audit");
    await shot(page, `admin-audit-${suffix}.png`);
  }

  await openWithoutDevOverlay(adminDesktop, "/admin/investigations");
  const saffronHref = await adminDesktop
    .getByRole("link", { name: /Saffron House/i })
    .first()
    .getAttribute("href");
  if (!saffronHref)
    throw new Error("Could not find Saffron House investigation.");
  await openWithoutDevOverlay(adminDesktop, saffronHref);
  await shot(adminDesktop, "admin-investigation-saffron-house-desktop.png");
  await openWithoutDevOverlay(adminMobile, saffronHref);
  await shot(adminMobile, "admin-investigation-saffron-house-mobile.png");

  await openWithoutDevOverlay(adminDesktop, "/admin/proposals");
  const kebabProposalHref = await adminDesktop
    .getByRole("link", { name: /Kebab Corner/i })
    .first()
    .getAttribute("href");
  if (!kebabProposalHref)
    throw new Error("Could not find Kebab Corner proposal.");
  await openWithoutDevOverlay(adminDesktop, kebabProposalHref);
  await shot(adminDesktop, "admin-proposal-kebab-corner-desktop.png");
  await openWithoutDevOverlay(adminMobile, kebabProposalHref);
  await shot(adminMobile, "admin-proposal-kebab-corner-mobile.png");

  await adminDesktopContext.close();
  await adminMobileContext.close();
  await desktop.close();
  await mobile.close();
});
