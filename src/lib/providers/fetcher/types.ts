export type FetchedPage = {
  url: string;
  contentType: string;
  title: string;
  text: string;
  bytes: Uint8Array;
  isPdf: boolean;
};

export interface SafeFetcher {
  fetch(url: string, allowedDomains: string[]): Promise<FetchedPage>;
}
