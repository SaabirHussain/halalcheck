const genericPrefixes = ["info", "contact", "hello", "office", "manager"];

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
