// app/api/models/route.js
export async function GET() {
  // Put a short curated list; you can expand or fetch dynamically
  const bedrockModels = [
    {
      id: "anthropic.claude-3-haiku-20240307-v1:0",
      label: "Claude 3 haiku",
    },
    { id: "cohere.command-r-plus-v1:0", label: "Cohere Command R+ (Bedrock)" },
    { id: "amazon.nova-lite-v1:0", label: "Amazon Nova Lite (Bedrock)" },
  ];

  const azureModels = [
    {
      id: process.env.AZURE_OPENAI_DEPLOYMENT,
      label: `Azure: ${process.env.AZURE_OPENAI_DEPLOYMENT}`,
    },
  ];

  return Response.json({ bedrock: bedrockModels, azure: azureModels });
}
