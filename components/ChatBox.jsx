"use client";
import { useState } from "react";
import ModelSelector from "./ModelSelector";
import Message from "./Message";

const PROFILES = [
  { id: "qa", label: "Q&A (default)" },
  { id: "advisory_memo", label: "Advisory Memo" },
  { id: "clause_builder", label: "Clause Builder" },
  { id: "compliance_checklist", label: "Compliance Checklist" },
  { id: "draft_email", label: "Draft Email" },
  { id: "draft_notice", label: "Draft Notice" },
  { id: "table_csv", label: "Table (CSV)" },
];

const VERBOSITY = [
  { id: "short", label: "Short" },
  { id: "normal", label: "Detailed" },
  { id: "long", label: "Very Long" },
];

const STRATEGIES = [
  { id: "basic", label: "Basic" },
  { id: "multi_query", label: "Multi-Query" },
  { id: "rag_fusion", label: "RAG-Fusion (RRF)" },
  { id: "step_back", label: "Step-Back" },
  { id: "hyde", label: "HyDE" },
  { id: "decompose", label: "Decompose" },
];

export default function ChatBox() {
  const [providerModel, setProviderModel] = useState({
    provider: "bedrock",
    model: "",
  });
  const [strategy, setStrategy] = useState("basic");
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [citations, setCitations] = useState([]);
  const [sending, setSending] = useState(false);

  const [profile, setProfile] = useState("qa");
  const [verbosity, setVerbosity] = useState("normal");
  const [jurisdiction, setJurisdiction] = useState("India");
  const [maxTokens, setMaxTokens] = useState(1600);
  const [maxSegments, setMaxSegments] = useState(1);

  const canSend = !!providerModel.model && query.trim() && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // body: JSON.stringify({
        //   provider: providerModel.provider,
        //   model: providerModel.model,
        //   messages,
        //   query,
        //   topK: 6,
        //   strategy,
        // }),
        body: JSON.stringify({
          provider: providerModel.provider,
          model: providerModel.model,
          messages,
          query,
          topK: 6,
          strategy,
          profile,
          jurisdiction,
          verbosity,
          maxTokens,
          maxSegments,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");
      setMessages([
        ...messages,
        { role: "user", content: query },
        { role: "assistant", content: data.answer },
      ]);
      setCitations(data.citations || []);
      setQuery("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 16 }}>
      <h1>Legal RAG Chat</h1>
      <ModelSelector value={providerModel} onChange={setProviderModel} />

      <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
        <label>
          Strategy:&nbsp;
          <select
            value={strategy}
            onChange={(e) => setStrategy(e.target.value)}
          >
            {STRATEGIES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
        {/* <label>
          Format:&nbsp;
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            {PROFILES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label> */}

        <label>
          Verbosity:&nbsp;
          <select
            value={verbosity}
            onChange={(e) => setVerbosity(e.target.value)}
          >
            {VERBOSITY.map((v) => (
              <option key={v.id} value={v.id}>
                {v.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          Jurisdiction:&nbsp;
          <input
            value={jurisdiction}
            onChange={(e) => setJurisdiction(e.target.value)}
            style={{ width: 160 }}
          />
        </label>

        <label title="Max tokens per segment (model dependent)">
          Max tokens/segment:&nbsp;
          <input
            type="number"
            min={256}
            max={4096}
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            style={{ width: 90 }}
          />
        </label>

        {/* <label title="Number of auto-continue segments if the model stops due to length">
          Segments:&nbsp;
          <input
            type="number"
            min={1}
            max={5}
            value={maxSegments}
            onChange={(e) => setMaxSegments(Number(e.target.value))}
            style={{ width: 60 }}
          />
        </label> */}
      </div>

      <div style={{ marginTop: 12 }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your legal docs…"
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 6,
            border: "1px solid #ccc",
          }}
        />
        <button
          disabled={!canSend}
          onClick={send}
          style={{ marginTop: 8, padding: "8px 14px", borderRadius: 6 }}
        >
          {sending ? "Asking…" : "Ask"}
        </button>
      </div>

      <div style={{ marginTop: 20 }}>
        {messages.map((m, i) => (
          <Message key={i} role={m.role} content={m.content} />
        ))}
      </div>

      {citations.length > 0 && (
        <div style={{ marginTop: 16, fontSize: 14 }}>
          <h3>Sources</h3>
          <ul>
            {citations.map((c) => (
              <li key={c.label}>
                <strong>[{c.label}]</strong> {c.uri}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
