export default function Message({ role, content }) {
  const bg = role === "user" ? "#eef" : "#f7f7f7";
  return (
    <div
      style={{
        background: bg,
        padding: "10px 12px",
        borderRadius: 8,
        margin: "8px 0",
      }}
    >
      <strong>{role === "user" ? "You" : "Assistant"}</strong>
      <div style={{ whiteSpace: "pre-wrap" }}>{content}</div>
    </div>
  );
}
