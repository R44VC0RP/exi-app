import type {
  AssistantThreadStartedEvent,
  GenericMessageEvent,
} from "@slack/web-api";
import { client, getThread, updateStatusUtil } from "./slack-utils";
import { generateResponse } from "./generate-response";

export async function assistantThreadMessage(
  event: AssistantThreadStartedEvent,
) {
  const { channel_id, thread_ts } = event.assistant_thread;
  console.log("🧵 [ASSISTANT_THREAD] Starting new assistant thread");
  console.log("📍 [ASSISTANT_THREAD] Channel:", channel_id, "Thread:", thread_ts);
  console.log("📋 [ASSISTANT_THREAD] Full event:", JSON.stringify(event, null, 2));

  console.log("💬 [ASSISTANT_THREAD] Posting welcome message...");
  const welcomeResult = await client.chat.postMessage({
    channel: channel_id,
    thread_ts: thread_ts,
    text: "Hello, I'm an AI assistant built with the AI SDK by Vercel!",
  });
  console.log("✅ [ASSISTANT_THREAD] Welcome message posted:", welcomeResult.ok ? "success" : "failed");

  console.log("💡 [ASSISTANT_THREAD] Setting suggested prompts...");
  const promptsResult = await client.assistant.threads.setSuggestedPrompts({
    channel_id: channel_id,
    thread_ts: thread_ts,
    prompts: [
      {
        title: "Get the weather",
        message: "What is the current weather in London?",
      },
      {
        title: "Get the news",
        message: "What is the latest Premier League news from the BBC?",
      },
    ],
  });
  console.log("✅ [ASSISTANT_THREAD] Suggested prompts set:", promptsResult.ok ? "success" : "failed");
  console.log("🎉 [ASSISTANT_THREAD] Assistant thread setup completed");
}

export async function handleNewAssistantMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  console.log("💌 [ASSISTANT_MSG] Handling new assistant message");
  console.log("🔍 [ASSISTANT_MSG] Event details:", {
    user: event.user,
    channel: event.channel,
    thread_ts: event.thread_ts,
    text: event.text?.substring(0, 100) + "...",
    bot_id: event.bot_id,
    bot_profile: !!event.bot_profile
  });

  if (
    event.bot_id ||
    event.bot_id === botUserId ||
    event.bot_profile ||
    !event.thread_ts
  ) {
    console.log("⏭️ [ASSISTANT_MSG] Skipping message - validation failed:", {
      has_bot_id: !!event.bot_id,
      is_from_bot: event.bot_id === botUserId,
      has_bot_profile: !!event.bot_profile,
      has_thread_ts: !!event.thread_ts
    });
    return;
  }

  const { thread_ts, channel } = event;
  console.log("🎯 [ASSISTANT_MSG] Processing message in channel:", channel, "thread:", thread_ts);
  
  console.log("⏳ [ASSISTANT_MSG] Setting status to 'thinking'...");
  const updateStatus = updateStatusUtil(channel, thread_ts);
  await updateStatus("is thinking...");

  console.log("📜 [ASSISTANT_MSG] Fetching thread messages...");
  const messages = await getThread(channel, thread_ts, botUserId);
  console.log("📊 [ASSISTANT_MSG] Retrieved", messages.length, "messages from thread");

  console.log("🤖 [ASSISTANT_MSG] Generating AI response...");
  const result = await generateResponse(messages, updateStatus, { channel, thread_ts });
  console.log("📝 [ASSISTANT_MSG] AI response generated:", result ? `${result.substring(0, 100)}...` : "no response");

  if (result) {
    console.log("📤 [ASSISTANT_MSG] Posting AI response to Slack...");
    const postResult = await client.chat.postMessage({
      channel: channel,
      thread_ts: thread_ts,
      text: result,
      unfurl_links: false,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: result,
          },
        },
      ],
    });
    console.log("✅ [ASSISTANT_MSG] Response posted:", postResult.ok ? "success" : "failed");
  } else {
    console.log("🤐 [ASSISTANT_MSG] No response generated - staying silent");
  }

  console.log("🧹 [ASSISTANT_MSG] Clearing status...");
  await updateStatus("");
  console.log("🎉 [ASSISTANT_MSG] Assistant message handling completed");
}

export async function handleNewChannelThreadMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  console.log("🏢 [CHANNEL_THREAD] Handling new channel thread message");
  console.log("🔍 [CHANNEL_THREAD] Event details:", {
    user: event.user,
    channel: event.channel,
    thread_ts: event.thread_ts,
    text: event.text?.substring(0, 100) + "...",
    channel_type: event.channel_type,
    bot_id: event.bot_id,
    bot_profile: !!event.bot_profile
  });

  // Only handle human messages in a thread, not in IMs (handled elsewhere)
  if (
    event.bot_id ||
    event.bot_id === botUserId ||
    event.bot_profile ||
    !event.thread_ts ||
    !event.user ||
    event.channel_type === "im"
  ) {
    console.log("⏭️ [CHANNEL_THREAD] Skipping message - validation failed:", {
      has_bot_id: !!event.bot_id,
      is_from_bot: event.bot_id === botUserId,
      has_bot_profile: !!event.bot_profile,
      has_thread_ts: !!event.thread_ts,
      has_user: !!event.user,
      is_im: event.channel_type === "im"
    });
    return;
  }

  const { thread_ts, channel } = event;
  console.log("🎯 [CHANNEL_THREAD] Processing message in channel:", channel, "thread:", thread_ts);

  console.log("📜 [CHANNEL_THREAD] Fetching full thread to validate context...");
  // Fetch the full thread to determine initiator and whether the bot was invoked
  const { messages } = await client.conversations.replies({
    channel: channel,
    ts: thread_ts,
    limit: 50,
  });

  if (!messages || messages.length === 0) {
    console.log("❌ [CHANNEL_THREAD] No messages found in thread - aborting");
    return;
  }

  console.log("📊 [CHANNEL_THREAD] Found", messages.length, "messages in thread");

  // Parent message is the one whose ts === thread_ts
  const parentMessage = messages.find((m) => m.ts === thread_ts);
  const parentUser = (parentMessage as any)?.user as string | undefined;
  console.log("👤 [CHANNEL_THREAD] Thread parent user:", parentUser, "Current user:", event.user);

  // Only respond if the same user who started the thread is speaking
  if (!parentUser || parentUser !== event.user) {
    console.log("⏭️ [CHANNEL_THREAD] Skipping - not the thread initiator");
    return;
  }

  console.log("🔍 [CHANNEL_THREAD] Checking if thread was initiated by bot mention...");
  // Ensure the thread was initiated by mentioning the bot (to avoid hijacking arbitrary threads)
  const initiatedByMention = messages.some(
    (m) => !m.bot_id && !!m.text && m.text.includes(`<@${botUserId}>`),
  );

  if (!initiatedByMention) {
    console.log("⏭️ [CHANNEL_THREAD] Skipping - thread not initiated by bot mention");
    return;
  }

  console.log("✅ [CHANNEL_THREAD] Thread validation passed - proceeding with response");
  console.log("⏳ [CHANNEL_THREAD] Setting status to 'thinking'...");
  const updateStatus = updateStatusUtil(channel, thread_ts);
  await updateStatus("is thinking...");

  console.log("📜 [CHANNEL_THREAD] Getting core messages for AI processing...");
  const coreMessages = await getThread(channel, thread_ts, botUserId);
  console.log("📊 [CHANNEL_THREAD] Retrieved", coreMessages.length, "core messages");

  console.log("🤖 [CHANNEL_THREAD] Generating AI response...");
  const result = await generateResponse(coreMessages, updateStatus, { channel, thread_ts });
  console.log("📝 [CHANNEL_THREAD] AI response generated:", result ? `${result.substring(0, 100)}...` : "no response");

  if (result) {
    console.log("📤 [CHANNEL_THREAD] Posting AI response to Slack...");
    const postResult = await client.chat.postMessage({
      channel: channel,
      thread_ts: thread_ts,
      text: result,
      unfurl_links: false,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: result,
          },
        },
      ],
    });
    console.log("✅ [CHANNEL_THREAD] Response posted:", postResult.ok ? "success" : "failed");
  } else {
    console.log("🤐 [CHANNEL_THREAD] No response generated - staying silent");
  }

  console.log("🧹 [CHANNEL_THREAD] Clearing status...");
  await updateStatus("");
  console.log("🎉 [CHANNEL_THREAD] Channel thread message handling completed");
}
