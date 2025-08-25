// app/api/chat/route.js
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

const KB_ID = process.env.KNOWLEDGE_BASE_ID;

export async function POST(req) {
  try {
    const body = await req.json();
    const parsed = chatRequestSchema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({
          error:
            "Please pick a model from the dropdown and enter your question.",
        }),
        { status: 400 }
      );
    }
    const { provider, model, messages, query, topK } =
      chatRequestSchema.parse(body);

    // 1) RETRIEVE
    const results = await retrieveFromKb({
      knowledgeBaseId: KB_ID,
      query,
      topK,
    });

    const { labeled, contextBlock } = formatContextFromChunks(results);
    const systemText = buildLegalSystemPrompt();
    const userPrompt = makeUserPrompt(query, labeled);

    // 2) GENERATE (provider switch)
    let answer = "";
    if (provider === "bedrock") {
      const { system, messages: brMessages } = toBedrockMessages({
        systemText,
        contextBlock,
        chatHistory: messages,
        userPrompt,
      });
      answer = await bedrockConverse({
        modelId: model,
        system,
        messages: brMessages,
      });
    } else {
      const azMsgs = toAzureMessages({
        systemText,
        contextBlock,
        chatHistory: messages,
        userPrompt,
      });
      answer = await azureChat({
        endpoint: process.env.AZURE_OPENAI_ENDPOINT,
        deployment: model, // deployment name
        apiKey: process.env.AZURE_OPENAI_API_KEY,
        apiVersion: process.env.AZURE_OPENAI_API_VERSION,
        messages: azMsgs,
      });
    }

    // 3) Return with citations (URIs + labels)
    const citations = labeled.map(({ label, uri }) => ({ label, uri }));
    return Response.json({ answer, citations });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: e.message }), { status: 400 });
  }
}
