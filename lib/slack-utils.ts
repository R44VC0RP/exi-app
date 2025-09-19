import { WebClient } from '@slack/web-api';
import { CoreMessage } from 'ai'
import crypto from 'crypto'

const signingSecret = process.env.SLACK_SIGNING_SECRET!

export const client = new WebClient(process.env.SLACK_BOT_TOKEN);

// See https://api.slack.com/authentication/verifying-requests-from-slack
export async function isValidSlackRequest({
  request,
  rawBody,
}: {
  request: Request
  rawBody: string
}) {
  console.log('🔐 [SLACK_AUTH] Validating Slack request signature')
  const timestamp = request.headers.get('X-Slack-Request-Timestamp')
  const slackSignature = request.headers.get('X-Slack-Signature')
  console.log('📋 [SLACK_AUTH] Headers:', { timestamp, signature: slackSignature?.substring(0, 20) + '...' })

  if (!timestamp || !slackSignature) {
    console.log('❌ [SLACK_AUTH] Missing timestamp or signature')
    return false
  }

  // Prevent replay attacks on the order of 5 minutes
  const timeDiff = Math.abs(Date.now() / 1000 - parseInt(timestamp))
  console.log('⏰ [SLACK_AUTH] Time difference:', timeDiff, 'seconds')
  if (timeDiff > 60 * 5) {
    console.log('❌ [SLACK_AUTH] Timestamp out of range (replay attack protection)')
    return false
  }

  console.log('🔑 [SLACK_AUTH] Computing HMAC signature...')
  const base = `v0:${timestamp}:${rawBody}`
  const hmac = crypto
    .createHmac('sha256', signingSecret)
    .update(base)
    .digest('hex')
  const computedSignature = `v0=${hmac}`

  console.log('🔍 [SLACK_AUTH] Comparing signatures (timing-safe)...')
  // Prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(computedSignature),
    Buffer.from(slackSignature)
  )
  
  console.log('✅ [SLACK_AUTH] Signature validation result:', isValid ? 'VALID' : 'INVALID')
  return isValid
}

export const verifyRequest = async ({
  requestType,
  request,
  rawBody,
}: {
  requestType: string;
  request: Request;
  rawBody: string;
}) => {
  console.log('🔒 [VERIFY_REQUEST] Starting request verification');
  console.log('📋 [VERIFY_REQUEST] Request type:', requestType);
  
  console.log('🔐 [VERIFY_REQUEST] Validating Slack signature...');
  const validRequest = await isValidSlackRequest({ request, rawBody });
  
  if (!validRequest) {
    console.log('❌ [VERIFY_REQUEST] Invalid Slack signature - rejecting request');
    return new Response("Invalid request", { status: 400 });
  }
  
  if (requestType !== "event_callback") {
    console.log('❌ [VERIFY_REQUEST] Invalid request type - expected event_callback, got:', requestType);
    return new Response("Invalid request", { status: 400 });
  }
  
  console.log('✅ [VERIFY_REQUEST] Request verification passed');
};

export const updateStatusUtil = (channel: string, thread_ts: string) => {
  console.log('⏳ [STATUS_UTIL] Creating status updater for channel:', channel, 'thread:', thread_ts);
  return async (status: string) => {
    console.log('🔄 [STATUS_UTIL] Updating assistant thread status to:', status);
    try {
      const result = await client.assistant.threads.setStatus({
        channel_id: channel,
        thread_ts: thread_ts,
        status: status,
      });
      console.log('✅ [STATUS_UTIL] Status updated successfully:', result.ok ? 'success' : 'failed');
    } catch (error) {
      console.error('❌ [STATUS_UTIL] Error updating status:', error);
      throw error;
    }
  };
};

export async function getThread(
  channel_id: string,
  thread_ts: string,
  botUserId: string,
): Promise<CoreMessage[]> {
  console.log('📜 [GET_THREAD] Fetching thread messages');
  console.log('📍 [GET_THREAD] Channel:', channel_id, 'Thread:', thread_ts, 'Bot ID:', botUserId);
  
  const { messages } = await client.conversations.replies({
    channel: channel_id,
    ts: thread_ts,
    limit: 50,
  });

  console.log('📊 [GET_THREAD] Raw messages received:', messages?.length || 0);

  // Ensure we have messages
  if (!messages) {
    console.error('❌ [GET_THREAD] No messages found in thread');
    throw new Error("No messages found in thread");
  }

  console.log('🔄 [GET_THREAD] Processing messages for AI context...');
  const result = messages
    .map((message, index) => {
      const isBot = !!message.bot_id;
      console.log(`📝 [GET_THREAD] Message ${index + 1}:`, {
        isBot,
        hasText: !!message.text,
        user: message.user,
        bot_id: message.bot_id,
        textPreview: message.text?.substring(0, 50) + '...'
      });

      if (!message.text) {
        console.log(`⏭️ [GET_THREAD] Skipping message ${index + 1} - no text content`);
        return null;
      }

      // For app mentions, remove the mention prefix
      // For IM messages, keep the full text
      let content = message.text;
      if (!isBot && content.includes(`<@${botUserId}>`)) {
        console.log(`🔧 [GET_THREAD] Removing bot mention from message ${index + 1}`);
        content = content.replace(`<@${botUserId}> `, "");
      }

      const coreMessage = {
        role: isBot ? "assistant" : "user",
        content: content,
      } as CoreMessage;

      console.log(`✅ [GET_THREAD] Processed message ${index + 1}:`, {
        role: coreMessage.role,
        contentPreview: typeof coreMessage.content === 'string' ? coreMessage.content.substring(0, 50) + '...' : '[complex content]'
      });

      return coreMessage;
    })
    .filter((msg): msg is CoreMessage => msg !== null);

  console.log('📋 [GET_THREAD] Final processed messages:', result.length);
  console.log('🎯 [GET_THREAD] Message roles:', result.map(m => m.role).join(', '));
  return result;
}

export const getBotId = async () => {
  console.log('🤖 [GET_BOT_ID] Fetching bot user ID from Slack API...');
  try {
    const authResult = await client.auth.test();
    const { user_id: botUserId } = authResult;
    
    console.log('📋 [GET_BOT_ID] Auth test result:', {
      ok: authResult.ok,
      user: authResult.user,
      user_id: botUserId,
      team: authResult.team,
      team_id: authResult.team_id
    });

    if (!botUserId) {
      console.error('❌ [GET_BOT_ID] Bot user ID is undefined in auth response');
      throw new Error("botUserId is undefined");
    }
    
    console.log('✅ [GET_BOT_ID] Bot user ID retrieved:', botUserId);
    return botUserId;
  } catch (error) {
    console.error('❌ [GET_BOT_ID] Error fetching bot ID:', error);
    throw error;
  }
};
