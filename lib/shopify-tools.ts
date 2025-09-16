import { tool } from "ai";
import { z } from "zod";

type UpdateStatus = (status: string) => void;

const getShopifyEnv = () => {
  const rawDomain = process.env.SHOPIFY_DOMAIN;
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
  const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-10";

  if (!rawDomain) {
    throw new Error(
      "Missing Shopify domain. Set SHOPIFY_DOMAIN in env."
    );
  }
  if (!accessToken) {
    throw new Error(
      "Missing Shopify access token. Set SHOPIFY_ACCESS_TOKEN in env."
    );
  }

  const domain = rawDomain.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const baseUrl = `https://${domain}/admin/api/${apiVersion}`;
  return { baseUrl, accessToken };
};

const shopifyFetch = async <T>(
  path: string,
  init?: RequestInit,
  query?: Record<string, string | number | boolean | undefined>
): Promise<T> => {
  const { baseUrl, accessToken } = getShopifyEnv();

  const url = new URL(`${baseUrl}${path}`);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null) continue;
      url.searchParams.set(key, String(value));
    }
  }

  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": accessToken,
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify API error ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
};

export const buildShopifyRestTools = (updateStatus?: UpdateStatus) => ({
  shopifyListOrders: tool({
    description: "List Shopify orders with optional filters (REST)",
    parameters: z.object({
      status: z.enum(["open", "closed", "cancelled", "any"]),
      limit: z.number().int().min(1).max(250),
    }),
    execute: async ({
      status,
      limit,
    }) => {
      updateStatus?.("is listing shopify orders via rest api...");
      const data = await shopifyFetch<{
        orders: any[];
      }>(
        "/orders.json",
        undefined,
        {
          status,
          limit,
        }
      );
      return { orders: data.orders };
    },
  }),

  shopifySearchOrders: tool({
    description:
      "Search Shopify orders by simple text (matches order name or email) using REST",
    parameters: z.object({
      query: z.string().min(1).describe("text to match against name or email"),
      status: z.enum(["open", "closed", "cancelled", "any"]),
      limit: z.number().int().min(1).max(250),
    }),
    execute: async ({ query, status, limit }) => {
      updateStatus?.("is searching shopify orders via rest api (client-side filter)...");
      // REST API does not have a generic text search for orders; fetch a page and filter
      const data = await shopifyFetch<{ orders: any[] }>(
        "/orders.json",
        undefined,
        { status, limit: Math.min(limit, 250) }
      );
      const q = query.toLowerCase();
      const filtered = data.orders.filter((o) => {
        const name = String(o.name || "").toLowerCase();
        const email = String(o.email || "").toLowerCase();
        return name.includes(q) || email.includes(q);
      });
      return { orders: filtered.slice(0, limit) };
    },
  }),

  shopifyCreateOrder: tool({
    description: "Create a Shopify order (REST)",
    parameters: z.object({
      email: z.string().email(),
      lineItems: z
        .array(
          z.object({
            variantId: z.number().int().describe("variant_id for line item"),
            quantity: z.number().int().min(1),
            price: z.string(),
          })
        )
        .min(1),
    }),
    execute: async ({
      email,
      lineItems,
    }) => {
      updateStatus?.("is creating a shopify order via rest api...");
      const payload: any = {
        order: {
          email,
          line_items: lineItems.map((li: { variantId: number; quantity: number; price: string }) => ({
            variant_id: li.variantId,
            quantity: li.quantity,
            price: li.price,
          })),
        },
      };

      const data = await shopifyFetch<{ order: any }>(
        "/orders.json",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      return { order: data.order };
    },
  }),

  shopifyListCustomers: tool({
    description: "List Shopify customers (REST)",
    parameters: z.object({
      limit: z.number().int().min(1).max(250),
    }),
    execute: async ({ limit }) => {
      updateStatus?.("is listing shopify customers via rest api...");
      const data = await shopifyFetch<{ customers: any[] }>(
        "/customers.json",
        undefined,
        { limit }
      );
      return { customers: data.customers };
    },
  }),

  shopifySearchCustomers: tool({
    description: "Search Shopify customers using the REST search endpoint",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .describe(
          "Shopify customer search query, e.g. 'email:foo@bar.com' or 'first_name:ryan'"
        ),
      limit: z.number().int().min(1).max(250),
    }),
    execute: async ({ query, limit }) => {
      updateStatus?.("is searching shopify customers via rest api...");
      const data = await shopifyFetch<{ customers: any[] }>(
        "/customers/search.json",
        undefined,
        { query, limit }
      );
      return { customers: data.customers };
    },
  }),

  shopifyCreateCustomer: tool({
    description: "Create a Shopify customer (REST)",
    parameters: z.object({
      email: z.string().email(),
    }),
    execute: async (input: { email: string }) => {
      updateStatus?.("is creating a shopify customer via rest api...");
      const payload = {
        customer: {
          ...input,
        },
      };
      const data = await shopifyFetch<{ customer: any }>(
        "/customers.json",
        {
          method: "POST",
          body: JSON.stringify(payload),
        }
      );
      return { customer: data.customer };
    },
  }),
});

export type ShopifyRestTools = ReturnType<typeof buildShopifyRestTools>;


