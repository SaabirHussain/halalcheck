import { domainsMatchWithWwwApex } from "./contact-classification";

function normalizedUrl(value: string | URL) {
  const url = new URL(value.toString());
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

export function isSiteUrlAlreadyFetched(
  candidate: string | URL,
  fetchedUrls: Array<string | URL>,
) {
  const normalizedCandidate = normalizedUrl(candidate);
  return fetchedUrls.some((fetchedUrl) => {
    const normalizedFetched = normalizedUrl(fetchedUrl);
    return (
      normalizedCandidate.protocol === normalizedFetched.protocol &&
      normalizedCandidate.port === normalizedFetched.port &&
      normalizedCandidate.pathname === normalizedFetched.pathname &&
      normalizedCandidate.search === normalizedFetched.search &&
      domainsMatchWithWwwApex(
        normalizedCandidate.hostname,
        normalizedFetched.hostname,
      )
    );
  });
}

export function selectSameSiteLinks(
  html: string,
  firstUrl: string,
  alreadyFetched: Array<string | URL> = [],
) {
  const firstPageUrl = new URL(firstUrl);
  const seen = [firstUrl, ...alreadyFetched];
  const selected: URL[] = [];
  const links = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((match) => {
      try {
        return new URL(match[1]!, firstPageUrl);
      } catch {
        return null;
      }
    })
    .filter(
      (url): url is URL =>
        Boolean(
          url &&
            domainsMatchWithWwwApex(
              url.hostname,
              firstPageUrl.hostname,
            ) &&
            /about|menu|halal|contact|location|store|branch|find/i.test(
              url.pathname,
            ),
        ),
    );
  for (const link of links) {
    if (isSiteUrlAlreadyFetched(link, seen)) continue;
    selected.push(link);
    seen.push(link);
  }
  return selected;
}
