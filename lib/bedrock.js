// lib/bedrock.js
import {
  BedrockAgentRuntimeClient,
  RetrieveCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { fromIni } from "@aws-sdk/credential-providers";

const region = process.env.AWS_REGION || "us-east-1";

// credentials: prefer explicit env keys; else fall back to named profile
function awsConfig() {
  const hasKeys =
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY;
  return hasKeys
    ? { region }
    : {
        region,
        credentials: fromIni({ profile: process.env.AWS_PROFILE || "default" }),
      };
}

export const agentRt = new BedrockAgentRuntimeClient(awsConfig());
export const brt = new BedrockRuntimeClient(awsConfig());

export async function retrieveFromKb({ knowledgeBaseId, query, topK = 6 }) {
  const cmd = new RetrieveCommand({
    knowledgeBaseId,
    retrievalQuery: { text: query },
    retrievalConfiguration: {
      vectorSearchConfiguration: {
        numberOfResults: topK,
        // You can add filters/reranking here later
      },
    },
  });
  const res = await agentRt.send(cmd);
  // res.retrievalResults: [{ content:{text}, location:{s3Location:{uri}}, score, metadata }]
  return res?.retrievalResults ?? [];
}

// export async function bedrockConverse({
//   modelId,
//   messages,
//   system = [],
//   maxTokens = 800,
//   temperature = 0.2,
// }) {
//   // messages: [{role:'user'|'assistant', content:[{text:'...'}]}]
//   const params = {
//     modelId,
//     messages,
//     system,
//     inferenceConfig: { maxTokens, temperature },
//   };
//   const out = await brt.send(new ConverseCommand(params));
//   // out.output.message.content => [{text: "..."}]
//   const text =
//     out?.output?.message?.content?.map((p) => p.text).join("\n") || "";
//   return text;
// }

export async function bedrockConverse({
  modelId,
  messages,
  system = [],
  maxTokens = 1600,
  temperature = 0.2,
}) {
  const params = {
    modelId,
    messages,
    system,
    inferenceConfig: { maxTokens, temperature },
  };
  const out = await brt.send(new ConverseCommand(params));
  const parts = out?.output?.message?.content || [];
  const text = parts.map((p) => p.text).join("\n") || "";
  // Bedrock Converse includes a stopReason top-level:
  const stopReason = out?.stopReason || out?.output?.stopReason || null;
  return { text, stopReason };
}
