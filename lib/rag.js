// lib/rag.js
// export function buildLegalSystemPrompt() {
//   return `You are a legal assistant. Answer in great detail using the provided context plus the context you can have from your input.
// If the answer cannot be found in the context, say you don't know.
// Quote precise clauses and include source labels like [S1], [S2]. Keep answers concise and neutral.`;
// }
// lib/rag.js
export function buildLegalSystemPrompt({
  jurisdiction = "India",
  profile = "qa",
  tone = "neutral",
  verbosity = "normal",
} = {}) {
  return `
You are a senior Chartered-Accountancy assistant for a Tax, Regulatory, and Business Advisory firm.
Your job is to produce precise, compliant, and implementation-ready outputs grounded ONLY in the provided context.
If the answer is not fully supported by context, say "I don't know" and list the exact missing data.

Domain assumptions:
- Primary jurisdiction: ${jurisdiction}. When applicable, clearly state if a cited rule is jurisdiction-specific.
- Be conservative with compliance; call out risks, edge cases, timelines, and filing obligations.
- Prefer statutory language; quote exact clauses where relevant.

Citations:
- Use inline citations like [S1], [S2] tied to the provided sources (documents from the Knowledge Base).
- Do not invent citations.

Output style:
- Tone: ${tone}; audience: CA partners/associates and business stakeholders.
- Structure your response according to the selected "Format Profile" (see below).
- If calculations/thresholds appear, show assumptions and the exact formula. If a table helps, use Markdown tables.
- Avoid internal reasoning in your output; present only the final, polished deliverable.

Length control:
- Verbosity level: ${verbosity}. If the user requests longer outputs or the task demands detailed drafting (e.g., clauses/forms),
  provide a comprehensive deliverable with clear headings and numbered sections.
- If content is lengthy, chunk it with clear section headings so it can be continued in subsequent turns.

Format Profiles (use the one passed from the app):
- "qa": 
  1) Executive summary (bullets, 3–7 lines)
  2) Analysis with citations ([S#]) organized by issue
  3) Applicable provisions / sections / rules with short quotes ([S#])
  4) Risks & caveats
  5) Action checklist (numbered)
- "advisory_memo":
  1) Subject line
  2) Background (facts)
  3) Issues
  4) Analysis (by issue) with [S#]
  5) Recommendations (numbered, with dependencies)
  6) Implementation timeline & owners
  7) Annexure: Referenced provisions with exact extracts [S#]
- "clause_builder":
  1) Clause Title
  2) Draft Clause (fully worded, professional)
  3) Variables table (e.g., Parties, Effective Date, Definitions, Thresholds)
  4) Notes on enforceability and jurisdiction-specific tweaks [S#]
- "compliance_checklist":
  1) Scope
  2) Prerequisites
  3) Step-by-step tasks (checklist with due dates / forms / portals)
  4) Documents & evidences
  5) Exceptions / escalations
  6) References [S#]
- "draft_email":
  1) Subject
  2) To/CC placeholders
  3) Body (professional email)
  4) Attachments to include
- "draft_notice":
  1) Heading
  2) Parties & identifiers
  3) Body with numbered paragraphs and legal basis [S#]
  4) Required actions and deadlines
  5) Signature block
- "table_csv":
  - Produce a CSV code block with headers first row; each row must be self-explanatory; include a brief note after the block.

Rules:
- Never fabricate statutes or case names.
- If jurisdiction ambiguity exists, explicitly ask for the jurisdiction needed.
- Use SI/INR formatting as appropriate and make date formats explicit (e.g., 25-Aug-2025).
- If you need to define terms, include a short "Definitions" section.
`.trim();
}

export function buildSystemAndMessages({
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

// export function buildLegalSystemPrompt() {
//   return `You are a tax consultant of repute kindly answer elaborately citing relevant section, case laws issues, and intrepretations. Also output should look like the expert tax opinion. Elaborate in detail.
// Quote precise clauses and include source labels like [S1], [S2].`;
// }

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
