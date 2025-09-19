import { tool } from "ai";
import { z } from "zod";
import { exa } from "./utils";
import { buildShopifyRestTools } from "./shopify-tools";
import { client } from "./slack-utils";

    export const buildTools = (
        updateStatus?: (status: string) => void,
        slackContext?: { channel: string; thread_ts?: string }
    ) => ({
        searchWeb: tool({
            description: "Use this to search the web for information",
            parameters: z.object({
                query: z.string(),
            }),
            execute: async ({ query }) => {
                console.log('🌐 [TOOL_SEARCH_WEB] Web search tool called');
                console.log('🔍 [TOOL_SEARCH_WEB] Query:', query);
                
                console.log('⏳ [TOOL_SEARCH_WEB] Updating status...');
                updateStatus?.(`is searching the web for ${query}...`);
                
                console.log('🚀 [TOOL_SEARCH_WEB] Calling Exa search API...');
                const { results } = await exa.searchAndContents(query, {
                    livecrawl: "always",
                    numResults: 3,
                });

                console.log('📊 [TOOL_SEARCH_WEB] Search results received:', results.length);
                
                const formattedResults = results.map((result, index) => {
                    console.log(`📄 [TOOL_SEARCH_WEB] Result ${index + 1}:`, {
                        title: result.title?.substring(0, 50) + '...',
                        url: result.url,
                        textLength: result.text?.length || 0
                    });
                    
                    return {
                        title: result.title,
                        url: result.url,
                        snippet: result.text.slice(0, 1000),
                    };
                });

                console.log('✅ [TOOL_SEARCH_WEB] Web search completed successfully');
                return { results: formattedResults };
            },
        }),
        
        sendSlackMessage: tool({
            description: "Send an intermediate message to the current Slack thread (useful for status updates, progress reports, or multi-step communications)",
            parameters: z.object({
                message: z.string().describe("The message to send to the Slack thread"),
            }),
            execute: async ({ message }) => {
                console.log('💬 [TOOL_SLACK_MESSAGE] Sending intermediate Slack message');
                console.log('📝 [TOOL_SLACK_MESSAGE] Message content:', message.substring(0, 100) + '...');
                
                if (!slackContext?.channel) {
                    console.error('❌ [TOOL_SLACK_MESSAGE] No Slack context available - cannot send message');
                    throw new Error("No Slack context available for sending message");
                }
                
                console.log('📍 [TOOL_SLACK_MESSAGE] Sending to channel:', slackContext.channel, 'thread:', slackContext.thread_ts || 'none');
                
                try {
                    const result = await client.chat.postMessage({
                        channel: slackContext.channel,
                        thread_ts: slackContext.thread_ts,
                        text: message,
                        unfurl_links: false,
                        blocks: [
                            {
                                type: "section",
                                text: {
                                    type: "mrkdwn",
                                    text: message,
                                },
                            },
                        ],
                    });
                    
                    console.log('✅ [TOOL_SLACK_MESSAGE] Message sent successfully:', result.ok ? 'success' : 'failed');
                    return { 
                        success: result.ok,
                        timestamp: result.ts,
                        message: "Message sent to Slack thread"
                    };
                } catch (error) {
                    console.error('❌ [TOOL_SLACK_MESSAGE] Error sending message:', error);
                    throw error;
                }
            },
        }),
        
        ...buildShopifyRestTools(updateStatus),
    });


