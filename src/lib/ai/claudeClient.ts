export class AiGatewayNotConfiguredError extends Error {
  constructor() {
    super(
      "AI extraction isn't configured yet (missing AI_GATEWAY_API_KEY) — add one from the Vercel AI Gateway dashboard, or enter this profile manually for now."
    );
    this.name = "AiGatewayNotConfiguredError";
  }
}

const AI_GATEWAY_MESSAGES_URL = "https://ai-gateway.vercel.sh/v1/messages";
const MODEL = "anthropic/claude-sonnet-5";

/**
 * Direct Vercel AI Gateway integration (the Anthropic Messages API,
 * exposed 1:1 through the gateway -- confirmed against Vercel's docs
 * 2026-09-11) rather than the `@anthropic-ai/sdk` package or the `ai`
 * package, mirroring src/lib/email/resendClient.ts and
 * src/lib/sms/twilioClient.ts's "one API call doesn't need an SDK, stay
 * dependency-free" reasoning. No AI Gateway key is configured anywhere in
 * this project yet -- callers should treat AiGatewayNotConfiguredError as
 * an expected, handled case (fall back to manual entry), not a bug.
 *
 * Forces a single tool call so the response is always well-formed JSON
 * matching `toolSchema`, rather than parsing free-form text.
 */
export async function extractStructuredFromPdf<T>(params: {
  pdfBase64: string;
  taskInstructions: string;
  toolName: string;
  toolDescription: string;
  toolSchema: Record<string, unknown>;
}): Promise<T> {
  const apiKey = process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) {
    throw new AiGatewayNotConfiguredError();
  }

  const res = await fetch(AI_GATEWAY_MESSAGES_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 4096,
      tool_choice: { type: "tool", name: params.toolName },
      tools: [
        {
          name: params.toolName,
          description: params.toolDescription,
          input_schema: params.toolSchema,
        },
      ],
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: params.pdfBase64 },
            },
            { type: "text", text: params.taskInstructions },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI Gateway request failed (${res.status}): ${detail}`);
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; name?: string; input?: unknown }>;
  };
  const toolUse = data.content?.find((block) => block.type === "tool_use" && block.name === params.toolName);
  if (!toolUse || toolUse.input === undefined) {
    throw new Error("AI Gateway response didn't include the expected structured tool call.");
  }
  return toolUse.input as T;
}
