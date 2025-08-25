// lib/azure.js
export async function azureChat({
  endpoint,
  deployment,
  apiKey,
  apiVersion,
  messages,
  maxTokens = 800,
  temperature = 0.2,
}) {
  const url = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages, // [{role:'system'|'user'|'assistant', content:'...'}]
      temperature,
      max_tokens: maxTokens,
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Azure OpenAI error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data?.choices?.[0]?.message?.content || "";
}
