// utils/schema.js
import { z } from "zod";

export const chatRequestSchema = z.object({
  provider: z.enum(["bedrock", "azure"]),
  model: z.string().min(1), // bedrock modelId or azure deployment
  messages: z
    .array(
      z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
    )
    .default([]),
  query: z.string().min(1),
  topK: z.number().min(1).max(20).default(6),
});
