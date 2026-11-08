const genericPrefixes = ["info", "contact", "hello", "office", "manager"];
const thirdPartyListingDomains = [
  "order.online",
  "doordash.com",
  "ubereats.com",
  "skipthedishes.com",
  "grubhub.com",
  "seamless.com",
  "postmates.com",
  "fantuan.ca",
  "ritual.co",
  "toasttab.com",
  "facebook.com",
  "instagram.com",
  "linktr.ee",
  "yelp.com",
  "yelp.ca",
  "tripadvisor.com",
  "tripadvisor.ca",
  "google.com",
];

export type BusinessEmailClassification = {
  email: string;
  status: "unverified" | "ambiguous";
  isPersonal: boolean;
  domainMismatch: boolean;
  notes: string | null;
};

function normalizedDomain(value: string) {
  const domain = value.trim().toLowerCase();
  return domain.startsWith("www.") ? domain.slice(4) : domain;
}

export function domainsMatchWithWwwApex(a: string, b: string) {
  return normalizedDomain(a) === normalizedDomain(b);
}

export function isThirdPartyListingUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return thirdPartyListingDomains.some(
      (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
    );
  } catch {
    return false;
  }
}

export function classifyBusinessEmails(
  emails: string[],
  websiteDomain: string,
): BusinessEmailClassification[] {
  const uniqueEmails = [...new Set(emails)];
  const genericPrefix = (email: string) =>
    genericPrefixes.find((prefix) =>
      new RegExp(`^${prefix}@`, "i").test(email),
    );
  const candidates = uniqueEmails
    .map((email) => ({ email, prefix: genericPrefix(email) }))
    .filter(
      (
        candidate,
      ): candidate is { email: string; prefix: (typeof genericPrefixes)[number] } =>
        Boolean(
          candidate.prefix &&
            !/@(gmail|yahoo|outlook|hotmail)\./i.test(candidate.email) &&
            domainsMatchWithWwwApex(
              candidate.email.split("@")[1] ?? "",
              websiteDomain,
            ),
        ),
    );
  const preferred = candidates.sort(
    (a, b) =>
      genericPrefixes.indexOf(a.prefix) - genericPrefixes.indexOf(b.prefix),
  )[0]?.email;

  return uniqueEmails.map((email) => {
    const domain = email.split("@")[1] ?? "";
    const domainMismatch = !domainsMatchWithWwwApex(domain, websiteDomain);
    const isPersonal =
      !genericPrefix(email) || /@(gmail|yahoo|outlook|hotmail)\./i.test(email);
    return {
      email,
      status: email === preferred ? "unverified" : "ambiguous",
      isPersonal,
      domainMismatch,
      notes: domainMismatch
        ? "Email domain does not match the business website."
        : null,
    };
  });
}
