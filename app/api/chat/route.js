import { chatRequestSchema } from "@/utils/schema";
import { retrieveFromKb, bedrockConverse } from "@/lib/bedrock";
import { azureChat } from "@/lib/azure";
import {
  buildLegalSystemPrompt,
  formatContextFromChunks,
  makeUserPrompt,
  toBedrockMessages,
  toAzureMessages,
} from "@/lib/rag";
import {
  genMultiQueries,
  genStepBack,
  genHyDE,
  genDecomposed,
} from "@/lib/queryTransforms";
import { reciprocalRankFusion, uniqueUnion } from "@/lib/rrf";

const KB_ID = process.env.KNOWLEDGE_BASE_ID;

async function retrieveMany(queries, topK) {
  const lists = [];
  for (const q of queries) {
    const res = await retrieveFromKb({
      knowledgeBaseId: KB_ID,
      query: q,
      topK,
    });
    lists.push(res || []);
  }
  return lists;
}

// async function generateFinal({
//   provider,
//   model,
//   messages,
//   contextBlock,
//   query,
//   systemText,
// }) {
//   const userPrompt = makeUserPrompt(query, []); // URIs get attached later
//   if (provider === "bedrock") {
//     const { system, messages: brMessages } = toBedrockMessages({
//       systemText,
//       contextBlock,
//       chatHistory: messages,
//       userPrompt,
//     });
//     return bedrockConverse({ modelId: model, system, messages: brMessages });
//   }
//   const azMsgs = toAzureMessages({
//     systemText,
//     contextBlock,
//     chatHistory: messages,
//     userPrompt,
//   });
//   return azureChat({
//     endpoint: process.env.AZURE_OPENAI_ENDPOINT,
//     deployment: model,
//     apiKey: process.env.AZURE_OPENAI_API_KEY,
//     apiVersion: process.env.AZURE_OPENAI_API_VERSION,
//     messages: azMsgs,
//   });
// }

// import {
//   buildSystemAndMessages,
//   buildLegalSystemPrompt,
//   formatContextFromChunks,
//   makeUserPrompt,
//   toAzureMessages,
// } from "@/lib/rag";
// import { bedrockConverse } from "@/lib/bedrock";
// import { azureChat } from "@/lib/azure";

async function generateFinal({
  provider,
  model,
  messages,
  contextBlock,
  query,
  systemText,
  maxTokens,
  maxSegments,
}) {
  const userPrompt = makeUserPrompt(query, []); // URIs get listed in the footer anyway

  // Seed messages
  let sys = [{ text: systemText }];
  let convo = [
    ...(messages || []).map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    {
      role: "user",
      content: [{ text: `Context:\n${contextBlock}\n\n${userPrompt}` }],
    },
  ];

  let full = "";
  for (let seg = 0; seg < maxSegments; seg++) {
    let chunk, stopReason;

    if (provider === "bedrock") {
      const out = await bedrockConverse({
        modelId: model,
        system: sys,
        messages: convo,
        maxTokens,
      });
      chunk = out.text;
      stopReason = out.stopReason;
    } else {
      // azure expects OpenAI-style messages
      const azMsgs = [
        { role: "system", content: systemText },
        ...convo.map((m) => ({ role: m.role, content: m.content[0].text })),
      ];
      const out = await azureChat({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: model,
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        messages: azMsgs,
        maxTokens,
      });
      chunk = out.text;
      stopReason = out.stopReason;
    }

    full += (seg === 0 ? "" : "\n") + chunk;

    // If not cut for length, stop; Azure returns "length" on truncation, Bedrock uses e.g. "MAX_TOKENS"
    if (stopReason && /length|max/i.test(String(stopReason))) {
      // Ask to continue
      convo.push({ role: "assistant", content: [{ text: chunk }] });
      convo.push({
        role: "user",
        content: [
          {
            text: "Continue from where you stopped. Do not repeat previous text. Keep the same structure and citations.",
          },
        ],
      });
      continue;
    } else {
      break;
    }
  }

  return full.trim();
}

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Pick a model and enter a question." }),
        { status: 400 }
      );
    }

    // const { provider, model, messages, query, topK, strategy } = parsed.data;
    const {
      provider,
      model,
      messages,
      query,
      topK,
      strategy,
      profile,
      jurisdiction,
      verbosity,
      maxTokens,
      maxSegments,
    } = parsed.data;

    // --- retrieval strategies ---
    let combined = [];
    if (strategy === "basic") {
      combined = await retrieveFromKb({ knowledgeBaseId: KB_ID, query, topK });
    }

    if (strategy === "multi_query" || strategy === "rag_fusion") {
      const qs = await genMultiQueries({
        provider,
        model,
        question: query,
        n: 4,
      });
      const lists = await retrieveMany([query, ...qs], topK);
      combined =
        strategy === "rag_fusion"
          ? reciprocalRankFusion(lists)
          : uniqueUnion(lists);
    }

    if (strategy === "step_back") {
      const sb = await genStepBack({ provider, model, question: query });
      const lists = await retrieveMany([query, sb], topK);
      combined = uniqueUnion(lists);
    }

    if (strategy === "hyde") {
      const hyp = await genHyDE({ provider, model, question: query });
      // Use the hypothetical passage *as the query text* for retrieval
      const lists = await retrieveMany([query, hyp], topK);
      combined = reciprocalRankFusion(lists);
    }

    if (strategy === "decompose") {
      const subs = await genDecomposed({
        provider,
        model,
        question: query,
        n: 3,
      });
      const lists = await retrieveMany(
        subs,
        Math.max(2, Math.floor(topK / subs.length))
      );
      combined = uniqueUnion(lists);
    }

    // Fallback if somehow empty:
    if (!combined || combined.length === 0) {
      combined = await retrieveFromKb({ knowledgeBaseId: KB_ID, query, topK });
    }

    // build context + answer
    const { labeled, contextBlock } = formatContextFromChunks(combined);
    // const systemText = `You are a legal assistant. Answer ONLY from context. Cite [S#]. If unknown, say you don't know.`;
    const systemText = buildLegalSystemPrompt({
      jurisdiction,
      profile,
      verbosity,
    });

    const answer = await generateFinal({
      provider,
      model,
      messages,
      contextBlock,
      query,
      systemText,
      maxTokens,
      maxSegments,
    });

    const citations = labeled.map(({ label, uri }) => ({ label, uri }));
    return Response.json({ answer, citations, strategy });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
}
