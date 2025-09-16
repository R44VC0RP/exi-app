import type { SlackEvent } from "@slack/web-api";
import {
  assistantThreadMessage,
  handleNewAssistantMessage,
  handleNewChannelThreadMessage,
} from "@/lib/handle-messages";
import { waitUntil } from "@vercel/functions";
import { handleNewAppMention } from "@/lib/handle-app-mention";
import { verifyRequest, getBotId } from "@/lib/slack-utils";

export async function POST(request: Request) {
  const rawBody = await request.text();

  const payload = JSON.parse(rawBody);
  const requestType = payload.type as "url_verification" | "event_callback";

  // See https://api.slack.com/events/url_verification
  if (requestType === "url_verification") {
    return new Response(payload.challenge, { status: 200 });
  }

  await verifyRequest({ requestType, request, rawBody });

  try {
    const botUserId = await getBotId();

    const event = payload.event as SlackEvent;

    if (event.type === "app_mention") {
      waitUntil(handleNewAppMention(event, botUserId));
    }

    if (event.type === "assistant_thread_started") {
      waitUntil(assistantThreadMessage(event));
    }

    if (
      event.type === "message" &&
      !event.subtype &&
      !event.bot_id &&
      !event.bot_profile &&
      event.bot_id !== botUserId
    ) {
      if ((event as any).channel_type === "im") {
        waitUntil(handleNewAssistantMessage(event, botUserId));
      } else {
        waitUntil(handleNewChannelThreadMessage(event, botUserId));
      }
    }

    return new Response("Success!", { status: 200 });
  } catch (error) {
    console.error("Error generating response", error);
    return new Response("Error generating response", { status: 500 });
  }
}

export const maxDuration = 120;