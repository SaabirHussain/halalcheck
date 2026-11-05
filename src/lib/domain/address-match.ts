const tokenAliases: Record<string, string> = {
  st: "street",
  street: "street",
  ave: "avenue",
  avenue: "avenue",
  rd: "road",
  road: "road",
  blvd: "boulevard",
  boulevard: "boulevard",
  dr: "drive",
  drive: "drive",
  w: "west",
  west: "west",
  e: "east",
  east: "east",
  n: "north",
  north: "north",
  s: "south",
  south: "south",
};

function addressTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => tokenAliases[token] ?? token);
}

export function addressesMatch(a: string | null | undefined, b: string | null | undefined) {
  if (!a || !b) return false;
  const tokensA = addressTokens(a);
  const tokensB = addressTokens(b);
  const leadingNumberA = tokensA[0]?.match(/^\d+[a-z]?$/i)?.[0];
  const leadingNumberB = tokensB[0]?.match(/^\d+[a-z]?$/i)?.[0];
  const firstStreetWordA = tokensA[1];
  const firstStreetWordB = tokensB[1];
  return Boolean(
    leadingNumberA &&
      leadingNumberB &&
      leadingNumberA === leadingNumberB &&
      firstStreetWordA &&
      firstStreetWordA === firstStreetWordB,
  );
}
