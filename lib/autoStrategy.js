import { retrieveFromKb } from "./bedrock";
import {
  genMultiQueries,
  genStepBack,
  genHyDE,
  genDecomposed,
} from "./queryTransforms";
import { reciprocalRankFusion, uniqueUnion } from "./rrf";

// --- simple legal-aware analyzer ---
export function analyzeQuestion(q) {
  const text = q.toLowerCase();
  const hasCase = /\b(v\.|vs\.|versus|air\s?\d{4}|scc|all\s?er|us\s?\d+)/i.test(
    q
  );
  const hasStatute =
    /(\bsection\b|§|\barticle\b|\brule\b|\bord\.|u\.s\.c\.|ipc|crpc|cpc|it act|gdpr|hipaa)/i.test(
      q
    );
  const isHowWhy =
    /\b(how|why|principle|test|doctrine|framework|elements|factors)\b/.test(
      text
    );
  const isDefinition =
    /\b(define|meaning of|what is|difference between)\b/.test(text);
  const hasCompare = /\b(compare|contrast|vs\.|versus|difference)\b/.test(text);
  const hasDate = /\b(19|20)\d{2}\b/.test(text);
  const tokenLen = q.trim().split(/\s+/).length;
  const multiParts = (q.match(/\b(and|or|;|,)\b/gi) || []).length;
  return {
    hasCase,
    hasStatute,
    isHowWhy,
    isDefinition,
    hasCompare,
    hasDate,
    tokenLen,
    multiParts,
  };
}

// --- quick quality metrics on retrieval ---
function metrics(results) {
  const uniqUris = new Set();
  let sumScore = 0,
    cntScore = 0;
  for (const r of results || []) {
    const uri =
      r?.location?.s3Location?.uri ||
      r?.location?.webLocation?.url ||
      "uri:unknown";
    uniqUris.add(uri);
    if (typeof r?.score === "number") {
      sumScore += r.score;
      cntScore++;
    }
  }
  const avgScore = cntScore ? sumScore / cntScore : 0;
  return { n: results?.length || 0, uniqSources: uniqUris.size, avgScore };
}

// pass/fail gate for “good enough”
function goodEnough(m, topK) {
  const need = Math.max(3, Math.floor(topK * 0.6));
  return (
    (m.n >= need && m.uniqSources >= Math.min(3, need)) || m.avgScore >= 0.55
  );
}

// --- run one retrieve ---
async function R(query, topK, KB_ID) {
  return retrieveFromKb({ knowledgeBaseId: KB_ID, query, topK });
}

// --- main auto planner ---
export async function autoRetrievePlan({
  provider,
  model,
  query,
  topK,
  KB_ID,
  debug = false,
}) {
  const logs = [];
  const pushLog = (o) => {
    if (debug) logs.push(o);
  };

  const a = analyzeQuestion(query);
  pushLog({ step: "analyze", a });

  // Seed plan: choose order by intent
  let plan = [];
  if (a.hasCase || a.hasStatute) plan = ["basic", "multi_query", "rag_fusion"];
  else if (a.isDefinition || a.isHowWhy)
    plan = ["step_back", "multi_query", "hyde", "rag_fusion"];
  else if (a.hasCompare || a.multiParts >= 2 || a.tokenLen > 24)
    plan = ["decompose", "multi_query", "rag_fusion"];
  else plan = ["multi_query", "step_back", "rag_fusion", "hyde"];

  // Try strategies progressively, escalate if metrics poor
  // BASIC
  let combined = await R(query, topK, KB_ID);
  let m = metrics(combined);
  pushLog({ step: "basic", m });
  if (!plan.includes("basic")) plan.unshift("basic");
  if (goodEnough(m, topK)) return { combined, chosen: "basic", logs };

  for (const s of plan) {
    if (s === "multi_query") {
      const { genMultiQueries } = await import("./queryTransforms.js"); // ensure no cycles
      const qs = await genMultiQueries({
        provider,
        model,
        question: query,
        n: 4,
      });
      const lists = [];
      for (const q of [query, ...qs]) lists.push(await R(q, topK, KB_ID));
      const union = uniqueUnion(lists);
      m = metrics(union);
      pushLog({ step: "multi_query", qs, m });
      if (goodEnough(m, topK))
        return { combined: union, chosen: "multi_query", logs };
      combined = union;
    }

    if (s === "rag_fusion") {
      // If we haven't got multi-query lists, create small variants (2) to keep cost low
      const smallQs = [query];
      if (combined.length === 0) {
        const { genMultiQueries } = await import("./queryTransforms.js");
        smallQs.push(
          ...(await genMultiQueries({ provider, model, question: query, n: 2 }))
        );
      } else {
        // reuse last union: simulate lists by slicing (fallback)
        smallQs.push(query + " key points");
      }
      const lists = [];
      for (const q of smallQs) lists.push(await R(q, topK, KB_ID));
      const fused = reciprocalRankFusion(lists);
      m = metrics(fused);
      pushLog({ step: "rag_fusion", smallQs, m });
      if (goodEnough(m, topK))
        return { combined: fused, chosen: "rag_fusion", logs };
      combined = fused;
    }

    if (s === "step_back") {
      const { genStepBack } = await import("./queryTransforms.js");
      const sb = await genStepBack({ provider, model, question: query });
      const lists = [await R(query, topK, KB_ID), await R(sb, topK, KB_ID)];
      const union = uniqueUnion(lists);
      m = metrics(union);
      pushLog({ step: "step_back", sb, m });
      if (goodEnough(m, topK))
        return { combined: union, chosen: "step_back", logs };
      combined = union;
    }

    if (s === "hyde") {
      const { genHyDE } = await import("./queryTransforms.js");
      const hyp = await genHyDE({ provider, model, question: query });
      const lists = [await R(query, topK, KB_ID), await R(hyp, topK, KB_ID)];
      const fused = reciprocalRankFusion(lists);
      m = metrics(fused);
      pushLog({ step: "hyde", m });
      if (goodEnough(m, topK)) return { combined: fused, chosen: "hyde", logs };
      combined = fused;
    }

    if (s === "decompose") {
      const { genDecomposed } = await import("./queryTransforms.js");
      const subs = await genDecomposed({
        provider,
        model,
        question: query,
        n: 3,
      });
      const lists = [];
      for (const q of subs)
        lists.push(
          await R(q, Math.max(2, Math.floor(topK / subs.length)), KB_ID)
        );
      const union = uniqueUnion(lists);
      m = metrics(union);
      pushLog({ step: "decompose", subs, m });
      if (goodEnough(m, topK))
        return { combined: union, chosen: "decompose", logs };
      combined = union;
    }
  }

  // Fallback
  pushLog({ step: "fallback" });
  return { combined, chosen: "fallback", logs };
}
