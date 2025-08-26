// // lib/azure.js
// export async function azureChat({
//   endpoint,
//   deployment,
//   apiKey,
//   apiVersion,
//   messages,
//   maxTokens = 10000,
//   temperature = 0.2,
// }) {
//   const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
//   const res = await fetch(url, {
//     method: "POST",
//     headers: {
//       "api-key": apiKey,
//       "Content-Type": "application/json",
//     },
//     body: JSON.stringify({
//       messages, // [{role:'system'|'user'|'assistant', content:'...'}]
//       temperature,
//       max_tokens: maxTokens,
//     }),
//   });
//   if (!res.ok) {
//     const t = await res.text();
//     throw new Error(`Azure OpenAI error ${res.status}: ${t}`);
//   }
//   const data = await res.json();
//   return data?.choices?.[0]?.message?.content || "";
// }
export async function azureChat({
  endpoint,
  deployment,
  apiKey,
  apiVersion,
  messages,
  maxTokens = 1600,
  temperature = 0.2,
}) {
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "api-key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({ messages, temperature, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const msg = data?.choices?.[0]?.message?.content || "";
  const finishReason = data?.choices?.[0]?.finish_reason || null; // "stop" | "length" | ...
  return { text: msg, stopReason: finishReason };
}
