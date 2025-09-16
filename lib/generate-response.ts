import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText } from "ai";
import { buildTools } from "./tools";

export const generateResponse = async (
  messages: CoreMessage[],
  updateStatus?: (status: string) => void,
) => {
  const { text } = await generateText({
    model: openai("gpt-5"),
    temperature: 1,
    system: `you are exi, a slack bot assistant.
    - be chill, lowkey, and helpful; mirror the channel's vibe and emotions.
    - act like a professional coworker in an org: friendly, direct, and practical.
    - keep messages concise; use emojis sparingly when appropriate.
    - write all non-url text in lowercase only. do not use uppercase, unless quoting something or referencing something else
    - do not tag users.
    - current date is: ${new Date().toISOString().split("T")[0]}
    - if you use web search, always include sources inline (slack mrkdwn links).
    - when helpful, suggest what the user might want next based on context/tools. keep it to one short line prefixed with "suggestion:"
    - if the best action is to stay silent (e.g., the conversation is over, the user is only acknowledging, or there is nothing substantive to add), output exactly "<no_reply>" and nothing else.`,
    messages,
    maxSteps: 20,
    tools: buildTools(updateStatus),
  });

  // Convert markdown to Slack mrkdwn format
  const trimmed = text.trim();
  if (trimmed.toLowerCase() === "<no_reply>") return "";
  return trimmed
    .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
    .replace(/\*\*/g, "*");
};
