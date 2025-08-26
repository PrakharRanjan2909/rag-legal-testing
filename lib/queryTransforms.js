// lib/queryTransforms.js
import { askLLM } from "./askLLM";

export async function genMultiQueries({ provider, model, question, n = 4 }) {
  const prompt = `Generate ${n} diverse rephrasings of this question, one per line, no numbering:
"${question}"`;
  const out = await askLLM({
    provider,
    model,
    prompt,
    temperature: 0.1,
    maxTokens: 400,
  });
  return out
    .split("\n")
    .map((s) => s.replace(/^\d+\W*/, "").trim())
    .filter(Boolean);
}

export async function genStepBack({ provider, model, question }) {
  const prompt = `Rewrite the question into a more general "step-back" version (one line only):
"${question}"`;
  const out = await askLLM({
    provider,
    model,
    prompt,
    temperature: 0.1,
    maxTokens: 200,
  });
  return out.split("\n")[0].trim();
}

export async function genHyDE({ provider, model, question }) {
  const prompt = `Write a concise, textbook-style passage that would answer:
"${question}"
Keep it 5-8 sentences.`;
  return askLLM({ provider, model, prompt, temperature: 0.2, maxTokens: 600 });
}

export async function genDecomposed({ provider, model, question, n = 3 }) {
  const prompt = `Break the question into ${n} sub-questions, one per line, no numbering:
"${question}"`;
  const out = await askLLM({
    provider,
    model,
    prompt,
    temperature: 0.1,
    maxTokens: 300,
  });
  return out
    .split("\n")
    .map((s) => s.replace(/^\d+\W*/, "").trim())
    .filter(Boolean);
}
