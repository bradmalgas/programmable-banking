const { app } = require("@azure/functions");
const { google } = require("googleapis");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const GOOGLE_CREDS = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const VALID_CATEGORIES = [ // Temp: hardcoded list
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
    "Uncategorized"
];

function generateId(date, merchant, cents) {
  return `${date}_${merchant.replace(/[^a-z0-9]/gi, '').toUpperCase()}_${cents}`;
}

async function askGemini(merchantName, merchantCategory, amountVal) {
    try {
        const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash-lite",
            generationConfig: { responseMimeType: "application/json" }
        });

        const prompt = `You are a strict financial classifier for a personal budget.
        
        Transaction Details:
        - Merchant: "${merchantName}"
        - Merchant Classification: "${merchantCategory}"
        - Amount: R"${amountVal}"
        
        Allowed Categories: ${JSON.stringify(VALID_CATEGORIES)}
        
        Task:
        1. Analyze the Merchant and Merchant Classification.
        2. Assign the most accurate Category from the allowed list.
        3. Determine sentiment (Essential vs Discretionary).
        4. Return JSON: {"category": "String", "sentiment": "String", "confidence": Number}
        `;

        const result = await model.generateContent(prompt);
        const text = await result.response.text();
        return JSON.parse(text);

    } catch (error) {
        console.error("Gemini Error:", error);
        return { category: "Uncategorized", sentiment: "Discretionary", confidence: 0.0 };
    }
}

app.http("addTransaction", {
  methods: ["POST"],
  authLevel: "function",
  handler: async (request, context) => {
    try {
      const input = await request.json();

      const date = input.dateTime;
      const merchant = input.merchant.name;
      const cents = input.centsAmount;
      const city = input.merchant.city || "Unknown";
      const merchantCategory = input.merchant.category || "Unknown";
      const id = generateId(date, merchant, cents);

      // Authenticate with Google
      const auth = new google.auth.GoogleAuth({
        credentials: GOOGLE_CREDS,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });

      // Initialize Google Sheets API
      const sheets = google.sheets({ version: "v4", auth });
      const spreadsheetData = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: SPREADSHEET_ID,
        ranges: ["raw_transactions!A:A", "lookup_map!A:C"],
      });

      const idRowValues = spreadsheetData.data.valueRanges[0].values || [];
      const lookupMapValues = spreadsheetData.data.valueRanges[1].values || [];

      // Remove headers / row names
      const idRows = idRowValues.slice(1);
      const mapRows = lookupMapValues.slice(1);

      // Check for duplicate transaction ID
      const recentIds = idRows.slice(-50).flat();
      if (recentIds.includes(id)) {
        context.log("Duplicate transaction detected, skipping entry.");
        context.res = {
          status: 200,
          body: "Duplicate transaction, not recorded.",
        };
        return context.res;
      }

      // Clean up values
      const cleanedMerchant = merchant
        ? merchant.toUpperCase()
        : "UNKNOWN";
      const randAmount = (cents / 100).toFixed(2);

      let category = "Uncategorized";
      let sentiment = "Discretionary";
      let confidence = 0.0;
      let source = "LLM";

      // Sort lookup map by length of merchant name (longest first)
      mapRows.sort((a, b) => {
        const keyA = a[0] ? a[0].length : 0;
        const keyB = b[0] ? b[0].length : 0;
        return keyB - keyA;
      });

      // Attempt to find a match in the lookup map
      const foundRule = mapRows.find((row) => {
        if (!row[0]) return false;
        return cleanedMerchant.includes(row[0].toUpperCase());
      });

      // Use the found rule if available, otherwise fallback to Gemini
      if (foundRule) {
        category = foundRule[1];
        sentiment = foundRule[2];
        confidence = 1.0;
        source = "MAP";
      } else {
        const aiResult = await askGemini(cleanedMerchant, merchantCategory, randAmount);
        category = aiResult.category;
        sentiment = aiResult.sentiment;
        confidence = aiResult.confidence;
      }

      // Append the new transaction data to the Google Sheet
      await sheets.spreadsheets.values.append({
        spreadsheetId: SPREADSHEET_ID,
        range: "raw_transactions!A:J",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            [
              id,
              date,
              merchant,
              randAmount,
              category,
              sentiment,
              confidence,
              source,
              city,
              new Date().toISOString(),
            ],
          ],
        },
      });

      // Send a successful response back to the client
      context.res = {
        status: 200,
        body: "Transaction data successfully recorded!",
      };

      context.log("Success message returned");
    } catch (error) {
      context.log("Error writing to Google Sheets:", error.message);
      context.res = {
        status: 500,
        body: "Failed to record transaction data.",
      };
    } finally {
      return context.res;
    }
  },
});
