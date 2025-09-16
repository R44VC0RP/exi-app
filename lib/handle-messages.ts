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
  console.log(`Thread started: ${channel_id} ${thread_ts}`);
  console.log(JSON.stringify(event));

  await client.chat.postMessage({
    channel: channel_id,
    thread_ts: thread_ts,
    text: "Hello, I'm an AI assistant built with the AI SDK by Vercel!",
  });

  await client.assistant.threads.setSuggestedPrompts({
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
}

export async function handleNewAssistantMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  if (
    event.bot_id ||
    event.bot_id === botUserId ||
    event.bot_profile ||
    !event.thread_ts
  )
    return;

  const { thread_ts, channel } = event;
  const updateStatus = updateStatusUtil(channel, thread_ts);
  await updateStatus("is thinking...");

  const messages = await getThread(channel, thread_ts, botUserId);
  const result = await generateResponse(messages, updateStatus);

  if (result) {
    await client.chat.postMessage({
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
  }

  await updateStatus("");
}

export async function handleNewChannelThreadMessage(
  event: GenericMessageEvent,
  botUserId: string,
) {
  // Only handle human messages in a thread, not in IMs (handled elsewhere)
  if (
    event.bot_id ||
    event.bot_id === botUserId ||
    event.bot_profile ||
    !event.thread_ts ||
    !event.user ||
    event.channel_type === "im"
  )
    return;

  const { thread_ts, channel } = event;

  // Fetch the full thread to determine initiator and whether the bot was invoked
  const { messages } = await client.conversations.replies({
    channel: channel,
    ts: thread_ts,
    limit: 50,
  });

  if (!messages || messages.length === 0) return;

  // Parent message is the one whose ts === thread_ts
  const parentMessage = messages.find((m) => m.ts === thread_ts);
  const parentUser = (parentMessage as any)?.user as string | undefined;

  // Only respond if the same user who started the thread is speaking
  if (!parentUser || parentUser !== event.user) return;

  // Ensure the thread was initiated by mentioning the bot (to avoid hijacking arbitrary threads)
  const initiatedByMention = messages.some(
    (m) => !m.bot_id && !!m.text && m.text.includes(`<@${botUserId}>`),
  );

  if (!initiatedByMention) return;

  const updateStatus = updateStatusUtil(channel, thread_ts);
  await updateStatus("is thinking...");

  const coreMessages = await getThread(channel, thread_ts, botUserId);
  const result = await generateResponse(coreMessages, updateStatus);

  if (result) {
    await client.chat.postMessage({
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
  }

  await updateStatus("");
}
