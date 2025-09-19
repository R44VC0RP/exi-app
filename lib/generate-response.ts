import { openai } from "@ai-sdk/openai";
import { CoreMessage, generateText } from "ai";
import { buildTools } from "./tools";

export const generateResponse = async (
  messages: CoreMessage[],
  updateStatus?: (status: string) => void,
  slackContext?: { channel: string; thread_ts?: string }
) => {
  console.log('🤖 [GENERATE_RESPONSE] Starting AI response generation');
  console.log('📊 [GENERATE_RESPONSE] Input messages count:', messages.length);
  console.log('⚙️ [GENERATE_RESPONSE] Has status updater:', !!updateStatus);

  const systemPrompt = `you are exi, a slack bot assistant.
    - be chill, lowkey, and helpful; mirror the channel's vibe and emotions.
    - act like a professional coworker in an org: friendly, direct, and practical.
    - keep messages concise; use emojis sparingly when appropriate.
    - write all non-url text in lowercase only. do not use uppercase, unless quoting something or referencing something else
    - do not tag users.
    - current date is: ${new Date().toISOString().split("T")[0]}
    - shopify store id: 3me346-hf
    - the shopify myshopify domain is: 3me346-hf.myshopify.com
    - you can send intermediate messages during your thinking process using the sendSlackMessage tool - use this for status updates, progress reports, or when you need to communicate something before your final response
    - if you use web search, always include sources inline (slack mrkdwn links).
    - when helpful, suggest what the user might want next based on context/tools. keep it to one short line prefixed with "suggestion:"
    - if the best action is to stay silent (e.g., the conversation is over, the user is only acknowledging, or there is nothing substantive to add), output exactly "<no_reply>" and nothing else.
    - when it makes sense to do so, use markdown formatting for the response
    `;

  console.log('🔧 [GENERATE_RESPONSE] Building tools for AI context...');
  console.log('📍 [GENERATE_RESPONSE] Slack context:', slackContext ? `${slackContext.channel}/${slackContext.thread_ts || 'no-thread'}` : 'none');
  const tools = buildTools(updateStatus, slackContext);
  console.log('🛠️ [GENERATE_RESPONSE] Tools built, count:', Object.keys(tools).length);

  console.log('🚀 [GENERATE_RESPONSE] Calling OpenAI generateText...');
  console.log('⚙️ [GENERATE_RESPONSE] Model: gpt-5, Temperature: 1, Max Steps: 20');
  
  try {
    const result = await generateText({
      model: openai("gpt-5"),
      temperature: 1,
      system: systemPrompt,
      messages,
      maxSteps: 20,
      tools: tools,
    });

    console.log('✅ [GENERATE_RESPONSE] AI response generated successfully');
    console.log('📝 [GENERATE_RESPONSE] Raw response length:', result.text.length);
    console.log('🔍 [GENERATE_RESPONSE] Raw response preview:', result.text.substring(0, 200) + '...');
    
    if (result.toolCalls && result.toolCalls.length > 0) {
      console.log('🛠️ [GENERATE_RESPONSE] Tool calls made:', result.toolCalls.length);
      result.toolCalls.forEach((call, index) => {
        console.log(`🔧 [GENERATE_RESPONSE] Tool call ${index + 1}:`, {
          toolName: call.toolName,
          args: Object.keys(call.args).join(', ')
        });
      });
    } else {
      console.log('💬 [GENERATE_RESPONSE] No tool calls made - direct text response');
    }

    // Convert markdown to Slack mrkdwn format
    console.log('🔄 [GENERATE_RESPONSE] Processing response for Slack formatting...');
    const trimmed = result.text.trim();
    
    if (trimmed.toLowerCase() === "<no_reply>") {
      console.log('🤐 [GENERATE_RESPONSE] AI decided to stay silent - returning empty response');
      return "";
    }
    
    const formatted = trimmed
      .replace(/\[(.*?)\]\((.*?)\)/g, "<$2|$1>")
      .replace(/\*\*/g, "*");
    
    console.log('📤 [GENERATE_RESPONSE] Final formatted response length:', formatted.length);
    console.log('🎯 [GENERATE_RESPONSE] Final response preview:', formatted.substring(0, 200) + '...');
    
    return formatted;
    
  } catch (error) {
    console.error('❌ [GENERATE_RESPONSE] Error during AI generation:', error);
    console.error('🔍 [GENERATE_RESPONSE] Error details:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    throw error;
  }
};
