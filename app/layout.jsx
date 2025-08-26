export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <title>Legal RAG Chat</title>
      </head>
      <body
        style={{ margin: 0, fontFamily: "system-ui, Segoe UI, Roboto, Arial" }}
      >
        {children}
      </body>
    </html>
  );
}
