"use client";
import { useState } from "react";
import ModelSelector from "./ModelSelector";
import Message from "./Message";

export default function ChatBox() {
  const [providerModel, setProviderModel] = useState({
    provider: "bedrock",
    model: "",
  });
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [citations, setCitations] = useState([]);
  const [sending, setSending] = useState(false);

  const canSend = !!providerModel.model && query.trim() && !sending;

  async function send() {
    if (!providerModel.model) return; // extra guard
    setSending(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: providerModel.provider,
          model: providerModel.model,
          messages,
          query,
          topK: 6,
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
        {!providerModel.model && (
          <div style={{ color: "#a00", fontSize: 12, marginTop: 6 }}>
            Pick a model from the dropdown first.
          </div>
        )}
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
