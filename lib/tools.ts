import { tool } from "ai";
import { z } from "zod";
import { exa } from "./utils";
import { buildShopifyRestTools } from "./shopify-tools";

    export const buildTools = (
        updateStatus?: (status: string) => void,
    ) => ({
        searchWeb: tool({
            description: "Use this to search the web for information",
            parameters: z.object({
                query: z.string(),
            }),
            execute: async ({ query }) => {
                updateStatus?.(`is searching the web for ${query}...`);
                const { results } = await exa.searchAndContents(query, {
                    livecrawl: "always",
                    numResults: 3,
                });

                return {
                    results: results.map((result) => ({
                        title: result.title,
                        url: result.url,
                        snippet: result.text.slice(0, 1000),
                    })),
                };
            },
        }),
        ...buildShopifyRestTools(updateStatus),
    });


