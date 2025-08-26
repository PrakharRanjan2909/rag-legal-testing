// // utils/schema.js
// // import { z } from "zod";

// // export const chatRequestSchema = z.object({
// //   provider: z.enum(["bedrock", "azure"]),
// //   model: z.string().min(1), // bedrock modelId or azure deployment
// //   messages: z
// //     .array(
// //       z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
// //     )
// //     .default([]),
// //   query: z.string().min(1),
// //   topK: z.number().min(1).max(20).default(6),
// // });

// import { z } from "zod";

// export const chatRequestSchema = z.object({
//   provider: z.enum(["bedrock", "azure"]),
//   model: z.string().min(1),
//   messages: z
//     .array(
//       z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
//     )
//     .default([]),
//   query: z.string().min(1),
//   topK: z.number().min(1).max(20).default(6),
//   strategy: z
//     .enum([
//       "basic",
//       "multi_query",
//       "rag_fusion",
//       "step_back",
//       "hyde",
//       "decompose",
//     ])
//     .default("basic"),
// });
import { z } from "zod";

export const chatRequestSchema = z.object({
  provider: z.enum(["bedrock", "azure"]),
  model: z.string().min(1),
  messages: z
    .array(
      z.object({ role: z.enum(["user", "assistant"]), content: z.string() })
    )
    .default([]),
  query: z.string().min(1),
  topK: z.number().min(1).max(20).default(6),
  strategy: z
    .enum([
      "basic",
      "multi_query",
      "rag_fusion",
      "step_back",
      "hyde",
      "decompose",
    ])
    .default("basic"),

  // NEW:
  profile: z
    .enum([
      "qa",
      "advisory_memo",
      "clause_builder",
      "compliance_checklist",
      "draft_email",
      "draft_notice",
      "table_csv",
    ])
    .default("qa"),
  jurisdiction: z.string().default("India"),
  verbosity: z.enum(["short", "normal", "long"]).default("normal"),
  maxSegments: z.number().min(1).max(5).default(1), // how many continuation segments to allow
  maxTokens: z.number().min(256).max(4096).default(1600), // per segment token budget (model-dependent)
});
