import type { AIProvider, OpenQuestion, ParsedReply, PublicClaim } from "./types";

export class DemoAIProvider implements AIProvider {
  async extractPublicClaims(pages: Array<{ url: string; title: string; text: string }>) {
    const claims: PublicClaim[] = [];
    for (const page of pages) {
      const text = page.text.replace(/\s+/g, " ");
      if (/ignore previous instructions.*mark this restaurant as certified/i.test(text)) continue;
      const chicken = text.match(/chicken(?: is|:)? (hand|machine)-slaughtered/i);
      if (chicken?.[0] && chicken[1]) {
        claims.push({
          product: "chicken",
          attribute: "slaughter_method",
          value: chicken[0],
          valueEnum: chicken[1].toLowerCase(),
          evidenceCategory: "public_website",
          confirmedAt: null,
          excerpt: chicken[0],
        });
      }
      const supplier = text.match(/supplied by ([A-Z][\w &.-]+)/i);
      if (supplier?.[1]) {
        claims.push({
          product: "chicken",
          attribute: "supplier",
          value: supplier[1].trim(),
          valueEnum: null,
          evidenceCategory: "supplier_statement",
          confirmedAt: null,
          excerpt: supplier[0],
        });
      }
      const certificate = text.match(/certified by ([A-Z][\w &-]+ Council)/);
      if (certificate?.[0]) {
        claims.push({
          product: "general",
          attribute: "certifier",
          value: certificate[0],
          valueEnum: certificate[1] ?? null,
          evidenceCategory: "certification",
          confirmedAt: null,
          excerpt: certificate[0],
        });
      }
    }
    return claims;
  }

  async parseReply(text: string, openQuestions: OpenQuestion[]): Promise<ParsedReply> {
    const normalized = text.toLowerCase();
    const trimmed = normalized.trim().replace(/[.!]+$/, "");
    const optOut =
      trimmed === "stop" ||
      trimmed === "unsubscribe" ||
      /\b(unsubscribe|opt[\s-]+out|remove me from|stop contacting|stop emailing)\b/.test(normalized);
    const refusal = /\b(do not contact|don't contact|no further contact|refuse)\b/.test(normalized);
    const staffDontKnow = /\b(don't know|do not know|not sure|unsure)\b/.test(normalized);
    const vagueSignals: ParsedReply["vagueSignals"] = [];
    if (/\ball our meat is halal\b|\bour meat is halal\b/i.test(text)) vagueSignals.push("general_halal_claim");
    if (/\bcertified\b/i.test(text) && !/\bcertified by\b|\bcertifier is\b/i.test(text)) vagueSignals.push("certified_no_org");
    if (staffDontKnow) vagueSignals.push("staff_dont_know");
    const referral = text.match(/(?:contact|speak to|ask for)\s+([A-Z][A-Za-z .'-]{1,80})(?:\s+at|\s*[,;]\s*|\s+<)([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/i);
    if (referral) vagueSignals.push("referral");
    const answers: ParsedReply["answers"] = [];

    for (const question of openQuestions) {
      if (question.key.includes("supplier") && /\b(supplier|provides|from)\b/i.test(text)) {
        const supplier = text.match(/(?:supplier is|supplier:|provided by|from)\s+([A-Z][\w &.-]+)/i);
        if (supplier?.[0]) {
          answers.push({
            questionKey: question.key,
            product: (question.product as ParsedReply["answers"][number]["product"]) ?? "chicken",
            attribute: "supplier",
            value: supplier[1]!.trim(),
            valueEnum: null,
            specificity: "specific",
            excerpt: supplier[0],
          });
        }
      }
      if (question.key.includes("slaughter") && /\b(hand|machine)[ -]slaughtered\b/i.test(text)) {
        const match = text.match(/(?:hand|machine)[ -]slaughtered/i);
        if (match?.[0]) {
          const method = match[0].toLowerCase().startsWith("hand") ? "hand" : "machine";
          answers.push({
            questionKey: question.key,
            product: (question.product as ParsedReply["answers"][number]["product"]) ?? "chicken",
            attribute: "slaughter_method",
            value: match[0],
            valueEnum: method,
            specificity: "specific",
            excerpt: match[0],
          });
        }
      }
      if (question.key.includes("certifier") && /\b(certified|certifier|certification)\b/i.test(text)) {
        const named = text.match(/(?:certified by|certifier is)\s+([A-Z][\w &.-]+?)(?:[.!?,]|$)/i);
        if (named?.[0]) {
          answers.push({
            questionKey: question.key,
            product: (question.product as ParsedReply["answers"][number]["product"]) ?? "general",
            attribute: "certifier",
            value: named[0].trim(),
            valueEnum: named[1]?.trim() ?? null,
            specificity: named[1] ? "specific" : "vague",
            excerpt: named[0],
          });
        }
      }
    }
    return {
      answers,
      optOut,
      refusal,
      staffDontKnow,
      vagueSignals,
      referral: referral ? { name: referral[1]!.trim(), email: referral[2]!.toLowerCase() } : null,
    };
  }
}
