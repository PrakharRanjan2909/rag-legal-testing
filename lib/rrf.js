// lib/rrf.js
// Reciprocal Rank Fusion for lists of Retrieve() results
export function reciprocalRankFusion(resultLists, k = 60) {
  const map = new Map(); // key -> {doc, score}
  const keyOf = (r) =>
    (r?.location?.s3Location?.uri || "uri:unknown") +
    "|" +
    (r?.content?.text?.slice(0, 80) || "");

  for (const list of resultLists) {
    list.forEach((doc, rank) => {
      const key = keyOf(doc);
      const prev = map.get(key) || { doc, score: 0 };
      prev.score += 1 / (k + rank + 1);
      map.set(key, prev);
    });
  }
  return [...map.values()].sort((a, b) => b.score - a.score).map((x) => x.doc);
}

export function uniqueUnion(resultLists) {
  const seen = new Set();
  const out = [];
  const keyOf = (r) =>
    (r?.location?.s3Location?.uri || "uri:unknown") +
    "|" +
    (r?.content?.text?.slice(0, 80) || "");
  for (const list of resultLists) {
    for (const r of list) {
      const k = keyOf(r);
      if (!seen.has(k)) {
        seen.add(k);
        out.push(r);
      }
    }
  }
  return out;
}
