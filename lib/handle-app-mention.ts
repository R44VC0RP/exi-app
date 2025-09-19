import { AppMentionEvent } from "@slack/web-api";
import { client, getThread } from "./slack-utils";
import { generateResponse } from "./generate-response";

const updateStatusUtil = async (
  initialStatus: string,
  event: AppMentionEvent,
) => {
  console.log("⏳ [APP_MENTION_STATUS] Creating status updater with initial status:", initialStatus);
  console.log("📍 [APP_MENTION_STATUS] Channel:", event.channel, "Thread:", event.thread_ts ?? event.ts);
  
  const initialMessage = await client.chat.postMessage({
    channel: event.channel,
    thread_ts: event.thread_ts ?? event.ts,
    text: initialStatus,
  });

  console.log("📤 [APP_MENTION_STATUS] Initial status message posted:", initialMessage.ok ? "success" : "failed");

  if (!initialMessage || !initialMessage.ts) {
    console.error("❌ [APP_MENTION_STATUS] Failed to post initial message");
    throw new Error("Failed to post initial message");
  }

  console.log("✅ [APP_MENTION_STATUS] Status updater created with message ID:", initialMessage.ts);

  const updateMessage = async (status: string) => {
    console.log("🔄 [APP_MENTION_STATUS] Updating status message to:", status);
    const updateResult = await client.chat.update({
      channel: event.channel,
      ts: initialMessage.ts as string,
      text: status,
    });
    console.log("✅ [APP_MENTION_STATUS] Status updated:", updateResult.ok ? "success" : "failed");
  };
  return updateMessage;
};

export async function handleNewAppMention(
  event: AppMentionEvent,
  botUserId: string,
) {
  console.log("🗣️ [APP_MENTION] Handling new app mention");
  console.log("🔍 [APP_MENTION] Event details:", {
    user: event.user,
    channel: event.channel,
    thread_ts: event.thread_ts,
    text: event.text?.substring(0, 100) + "...",
    bot_id: event.bot_id,
    bot_profile: !!event.bot_profile,
    ts: event.ts
  });

  if (event.bot_id || event.bot_id === botUserId || event.bot_profile) {
    console.log("⏭️ [APP_MENTION] Skipping app mention - validation failed:", {
      has_bot_id: !!event.bot_id,
      is_from_bot: event.bot_id === botUserId,
      has_bot_profile: !!event.bot_profile
    });
    return;
  }

  const { thread_ts, channel } = event;
  console.log("🎯 [APP_MENTION] Processing app mention in channel:", channel, "thread:", thread_ts || "none");

  console.log("⏳ [APP_MENTION] Setting up status updater...");
  const updateMessage = await updateStatusUtil("is thinking...", event);

  if (thread_ts) {
    console.log("🧵 [APP_MENTION] App mention in existing thread - fetching context");
    console.log("📜 [APP_MENTION] Getting thread messages...");
    const messages = await getThread(channel, thread_ts, botUserId);
    console.log("📊 [APP_MENTION] Retrieved", messages.length, "messages from thread");
    
    console.log("🤖 [APP_MENTION] Generating AI response for thread context...");
    const result = await generateResponse(messages, updateMessage, { channel, thread_ts });
    console.log("📝 [APP_MENTION] AI response generated:", result ? `${result.substring(0, 100)}...` : "no response");
    
    console.log("🔄 [APP_MENTION] Updating status message with final response...");
    await updateMessage(result || "");
  } else {
    console.log("💬 [APP_MENTION] App mention in new conversation - direct response");
    console.log("🤖 [APP_MENTION] Generating AI response for direct mention...");
    const result = await generateResponse(
      [{ role: "user", content: event.text }],
      updateMessage,
      { channel, thread_ts: event.ts }
    );
    console.log("📝 [APP_MENTION] AI response generated:", result ? `${result.substring(0, 100)}...` : "no response");
    
    console.log("🔄 [APP_MENTION] Updating status message with final response...");
    await updateMessage(result || "");
  }
  
  console.log("🎉 [APP_MENTION] App mention handling completed");
}
