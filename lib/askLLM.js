// lib/askLLM.js
import { bedrockConverse } from "./bedrock";
import { azureChat } from "./azure";

export async function askLLM({
  provider,
  model,
  prompt,
  temperature = 0.2,
  maxTokens = 1600,
}) {
  if (provider === "bedrock") {
    const text = await bedrockConverse({
      modelId: model,
      system: [],
      messages: [{ role: "user", content: [{ text: prompt }] }],
      maxTokens,
      temperature,
    });
    return text;
  }
  return azureChat({
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: model,
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
    messages: [{ role: "user", content: prompt }],
    maxTokens,
    temperature,
  });
}
