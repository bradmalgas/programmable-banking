import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions";
import { GoogleGenAI, Type } from "@google/genai";
import { getBudgetStatus } from "../tools/get_budget_status";
import { searchTransactions } from "../tools/search_transactions";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const toolDefinitions = [
  {
    name: "getBudgetStatus",
    description: "Get budget targets vs actuals for a specific month.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        month: {
          type: Type.STRING,
          description: "The month to check in YYYY-MM format (e.g., 2026-02)",
        },
      },
      required: ["month"],
    },
  },
  {
    name: "searchTransactions",
    description:
      "Search transaction history for specific merchants, categories, dates or amounts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        merchant: {
          type: Type.STRING,
          description: "Name of the merchant (e.g., Uber)",
        },
        category: {
          type: Type.STRING,
          description: "The strict category name.",
          enum: [
            "Groceries",
            "Eating Out",
            "Alcohol",
            "Transport & Fuel",
            "Car & Maintenance",
            "Internet & Mobile",
            "Tech & Hardware",
            "Health & Medical",
            "Personal Care",
            "Home & Utilities",
            "Entertainment",
            "Travel",
            "Subscriptions",
            "Online Shopping",
            "Clothing",
            "Uncategorized",
          ],
        },
        month: { type: Type.STRING, description: "YYYY-MM format" },
        date: { 
                    type: Type.STRING, 
                    description: 'Specific date in YYYY-MM-DD format (e.g. 2026-02-11). Use this for "today", "yesterday", or specific days.' 
                },
        min_amount: { type: Type.NUMBER, description: "Minimum amount filter" },
        limit: { type: Type.NUMBER, description: "Max results to return" },
      },
    },
  },
];

const toolMap: any = {
  getBudgetStatus: getBudgetStatus,
  searchTransactions: searchTransactions,
};

export async function ask(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  try {
    const body = (await request.json()) as { question: string };
    const userQuestion = body.question;

    if (!userQuestion) return { status: 400, body: "Question is required." };

    // We send the user question and the tool definitions
    const response1 = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: `You are Budget Buddy, a helpful financial advisor. You have access to tools that can provide real data about the user's spending and budgets. Always use the tools when relevant to get accurate information before answering. Current Date: ${new Date().toISOString().split("T")[0]} - use this as the default if no date is specified. Currency: ZAR (R) - all values should be quoted in South African Rands. Always use tools to find facts. Never guess.`,
        tools: [{ functionDeclarations: toolDefinitions }],
      },
      contents: [{ role: "user", parts: [{ text: userQuestion }] }],
    });

    // MVP: Check if Gemini wants to call a function
    // Note: This can only handle a single function call.
    // Future version will support chained/sequential function calls (lol ideally when I can pay for gemini).
    const functionCalls = response1.functionCalls;

    if (functionCalls && functionCalls.length > 0) {
      const singleFunctionCall = functionCalls[0]; // MVP: Only handle the first (and ideally only) function call

      const toolFunction = toolMap[singleFunctionCall.name];
      if (!toolFunction) throw new Error(`Tool ${singleFunctionCall.name} not found`);

      const toolResult = await toolFunction(singleFunctionCall.args);

      // Construct conversation history: User Question -> Model (Function Call) -> Function (Result)
      const response2 = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        config: {
          systemInstruction: `You are Budget Buddy. Answer based on the tool result. Currency: ZAR (R) - all values should be quoted in South African Rands.`,
        },
        contents: [
          { role: "user", parts: [{ text: userQuestion }] },
          { role: "model", parts: [{ functionCall: singleFunctionCall }] },
          {
            role: "function",
            parts: [
              {
                functionResponse: {
                  name: singleFunctionCall.name,
                  response: { result: toolResult },
                },
              },
            ],
          },
        ],
      });

      return {
        status: 200,
        jsonBody: {
          reply: response2.text,
          tool: singleFunctionCall.name,
          data: toolResult,
        },
      };
    }

    // If no tool is needed
    return {
      status: 200,
      jsonBody: { reply: response1.text },
    };
  } catch (error: any) {
    context.error(error);
    return { status: 500, body: `Error: ${error.message}` };
  }
}

app.http("ask", {
  methods: ["POST"],
  authLevel: "function",
  handler: ask,
});
