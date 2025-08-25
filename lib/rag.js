// lib/rag.js
export function buildLegalSystemPrompt() {
  return `You are a legal assistant. Answer using only the provided context.
If the answer cannot be found in the context, say you don't know.
Quote precise clauses and include source labels like [S1], [S2]. Keep answers concise and neutral.`;
}

export function formatContextFromChunks(chunks) {
  // chunks: [{content:{text}, location:{s3Location:{uri}}, score}]
  // Deduplicate and label sources S1..Sn
  const uniq = [];
  const seen = new Set();
  for (const r of chunks) {
    const text = r?.content?.text || "";
    const uri =
      r?.location?.s3Location?.uri ||
      r?.location?.webLocation?.url ||
      "source:unknown";
    const key = text + "|" + uri;
    if (!seen.has(key) && text.trim()) {
      uniq.push({ text, uri });
      seen.add(key);
    }
  }
  const labeled = uniq.map((c, i) => ({ ...c, label: `S${i + 1}` }));
  const contextBlock = labeled
    .map((c) => `[${c.label}] ${c.text}`)
    .join("\n\n");
  return { labeled, contextBlock };
}

export function makeUserPrompt(userQuestion, labeledChunks) {
  // Append a short bibliography of sources at the end as hints
  const refs = labeledChunks.map((c) => `${c.label}: ${c.uri}`).join("\n");
  return `User question:\n${userQuestion}\n\nCitations (URIs):\n${refs}`;
}

export function toBedrockMessages({
  systemText,
  contextBlock,
  chatHistory,
  userPrompt,
}) {
  const system = [{ text: systemText }];
  const messages = [
    ...(chatHistory || []).map((m) => ({
      role: m.role,
      content: [{ text: m.content }],
    })),
    {
      role: "user",
      content: [{ text: `Context:\n${contextBlock}\n\n${userPrompt}` }],
    },
  ];
  return { system, messages };
}

export function toAzureMessages({
  systemText,
  contextBlock,
  chatHistory,
  userPrompt,
}) {
  const msgs = [
    { role: "system", content: systemText },
    ...(chatHistory || []),
    { role: "user", content: `Context:\n${contextBlock}\n\n${userPrompt}` },
  ];
  return msgs;
}
