"use client";

import { useEffect, useState } from "react";

export default function ModelSelector({ value, onChange }) {
  const [models, setModels] = useState({ bedrock: [], azure: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/models");
        const m = await r.json();
        setModels(m);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Pick a default model when models load or provider changes
  useEffect(() => {
    const list = value.provider === "bedrock" ? models.bedrock : models.azure;
    if (list.length === 0) {
      if (value.model) onChange({ ...value, model: "" });
      return;
    }
    const exists = list.some((m) => m.id === value.model);
    if (!exists) onChange({ ...value, model: list[0].id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [models, value.provider]);

  const list = value.provider === "bedrock" ? models.bedrock : models.azure;

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <select
        value={value.provider}
        onChange={(e) => onChange({ ...value, provider: e.target.value })}
      >
        <option value="bedrock">Bedrock</option>
        <option value="azure" disabled={models.azure.length === 0}>
          Azure OpenAI
        </option>
      </select>

      <select
        value={value.model || ""}
        onChange={(e) => onChange({ ...value, model: e.target.value })}
        disabled={loading || list.length === 0}
      >
        {list.length === 0 ? (
          <option value="">
            {loading ? "Loading…" : "No models available"}
          </option>
        ) : (
          list.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))
        )}
      </select>
    </div>
  );
}
