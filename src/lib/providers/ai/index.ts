import { DemoAIProvider } from "./demo";
import { OpenAICompatibleProvider } from "./openai";
import type { AIProvider } from "./types";

let warned = false;

export function getAIProvider(): AIProvider {
  const { AI_PROVIDER, AI_BASE_URL, AI_API_KEY, AI_MODEL } = process.env;
  if (AI_PROVIDER === "openai" && AI_BASE_URL && AI_API_KEY && AI_MODEL) {
    return new OpenAICompatibleProvider(AI_BASE_URL, AI_API_KEY, AI_MODEL);
  }
  if (AI_PROVIDER === "openai" && !warned) {
    warned = true;
    console.warn(
      "OpenAI-compatible AI selected without complete credentials; using demo provider.",
    );
  }
  return new DemoAIProvider();
}

export type {
  AIProvider,
  OpenQuestion,
  ParsedReply,
  PublicClaim,
} from "./types";
