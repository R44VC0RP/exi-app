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
  console.log("🚀 [EVENTS] Incoming Slack event request");
  
  const rawBody = await request.text();
  console.log("📦 [EVENTS] Raw body received, length:", rawBody.length);

  const payload = JSON.parse(rawBody);
  const requestType = payload.type as "url_verification" | "event_callback";
  console.log("🔍 [EVENTS] Request type:", requestType);

  // See https://api.slack.com/events/url_verification
  if (requestType === "url_verification") {
    console.log("✅ [EVENTS] URL verification challenge received:", payload.challenge);
    return new Response(payload.challenge, { status: 200 });
  }

  console.log("🔐 [EVENTS] Verifying request signature...");
  await verifyRequest({ requestType, request, rawBody });
  console.log("✅ [EVENTS] Request signature verified");

  try {
    console.log("🤖 [EVENTS] Getting bot user ID...");
    const botUserId = await getBotId();
    console.log("🆔 [EVENTS] Bot user ID:", botUserId);

    const event = payload.event as SlackEvent;
    console.log("📨 [EVENTS] Event type:", event.type);
    console.log("📄 [EVENTS] Full event payload:", JSON.stringify(event, null, 2));

    if (event.type === "app_mention") {
      console.log("🗣️ [EVENTS] App mention detected, delegating to handler");
      waitUntil(handleNewAppMention(event, botUserId));
    }

    if (event.type === "assistant_thread_started") {
      console.log("🧵 [EVENTS] Assistant thread started, delegating to handler");
      waitUntil(assistantThreadMessage(event));
    }

    if (
      event.type === "message" &&
      !event.subtype &&
      !event.bot_id &&
      !event.bot_profile &&
      event.bot_id !== botUserId
    ) {
      console.log("💬 [EVENTS] Valid message event detected");
      console.log("📋 [EVENTS] Message details:", {
        channel_type: (event as any).channel_type,
        user: (event as any).user,
        text: (event as any).text?.substring(0, 100) + "...",
        thread_ts: (event as any).thread_ts
      });

      if ((event as any).channel_type === "im") {
        console.log("💌 [EVENTS] Direct message detected, delegating to assistant handler");
        waitUntil(handleNewAssistantMessage(event, botUserId));
      } else {
        console.log("🏢 [EVENTS] Channel thread message detected, delegating to thread handler");
        waitUntil(handleNewChannelThreadMessage(event, botUserId));
      }
    } else {
      console.log("⏭️ [EVENTS] Message event skipped - conditions not met:", {
        type: event.type,
        subtype: (event as any).subtype,
        bot_id: (event as any).bot_id,
        bot_profile: !!(event as any).bot_profile,
        is_bot_message: (event as any).bot_id === botUserId
      });
    }

    console.log("✅ [EVENTS] Event processing completed successfully");
    return new Response("Success!", { status: 200 });
  } catch (error) {
    console.error("❌ [EVENTS] Error processing event:", error);
    console.error("🔍 [EVENTS] Error stack:", error instanceof Error ? error.stack : "No stack trace");
    return new Response("Error generating response", { status: 500 });
  }
}

export const maxDuration = 120;