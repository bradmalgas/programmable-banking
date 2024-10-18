const { app } = require("@azure/functions");
const { google } = require("googleapis");

app.http("addTransaction", {
  methods: ["GET", "POST"],
  authLevel: "function",
  handler: async (request, context) => {
    try {
      // Read the body stream and convert it to a JSON object
      const req = await request.text();
      const input = JSON.parse(req);

      // Extract the dateTime from input (or use a default if not provided)
      const isoDate = input?.dateTime ?? null;

      // If isoDate exists, format it, otherwise use 'N/A'
      const formattedDate = isoDate
        ? `${new Date(isoDate).toLocaleDateString("en-US", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}, ${new Date(isoDate).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: true,
          })}`
        : "N/A";

      const transactionData = {
        date: formattedDate,
        expense: `${input.merchant?.name ?? "Unknown"} - ${
          input.merchant?.city ?? "Unknown"
        }`,
        amount: input.centsAmount ?? 0,
        category: input.merchant.category?.name ?? "Uncategorized",
      };

      // Parse the Google service account key
      context.log("Parsing service account key...");
      const serviceAccountKey = JSON.parse(
        process.env.GOOGLE_SERVICE_ACCOUNT_KEY
      );
      context.log("Service account key parsed successfully.");

      // Authenticate with Google
      context.log("Authenticating with Google...");
      const auth = new google.auth.GoogleAuth({
        credentials: serviceAccountKey,
        scopes: ["https://www.googleapis.com/auth/spreadsheets"],
      });
      context.log("Authentication successful.");

      // Initialize Google Sheets API
      const sheets = google.sheets({ version: "v4", auth });

      // Append the transaction data to a specific sheet
      const spreadsheetId = process.env.SPREADSHEET_ID;
      const range = "Sheet1!A1";

      context.log("Appending data to Google Sheets:", transactionData);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              transactionData.date,
              transactionData.expense,
              transactionData.amount,
              transactionData.category,
            ],
          ],
        },
      });

      context.log("Data appended successfully");

      // Send a successful response back to the client
      context.res = {
        status: 200,
        body: "Transaction data successfully recorded!",
      };

      context.log("Success message returned");
    } catch (error) {
      context.log("Error writing to Google Sheets:", error);
      context.res = {
        status: 500,
        body: "Failed to record transaction data.",
      };
    } finally {
      return context.res;
    }
  },
});
