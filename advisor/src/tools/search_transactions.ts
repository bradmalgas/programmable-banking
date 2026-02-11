import { GoogleSheetsClient } from "../sheets/googleSheetsClient";

interface Transaction {
  date: string;
  merchant: string;
  amount: number;
  category: string;
}

interface SearchTransactionsResult {
    query_summary: string;
    total_found: number;
    transaction_count: number;
    transactions: Transaction[];
}

interface SearchParameters {
    merchant?: string;
    category?: string;
    month?: string;
    date?: string;
    min_amount?: number;
    limit?: number;
}

export async function searchTransactions(params: SearchParameters): Promise<SearchTransactionsResult> {
    let sheets: GoogleSheetsClient;
    try {
        sheets = new GoogleSheetsClient();
    } catch (error) {
        throw new Error(`Failed to initialize Google Sheets client: ${error instanceof Error ? error.message : String(error)}`);
    }

    const transactionsData = await sheets.readRange("raw_transactions!B2:E");

    let total = 0;
    const matches: Transaction[] = [];
    const limit = params.limit || 10;

    for (const row of transactionsData) {
        const date = row[0];
        const merchant = (row[1] || "").toLowerCase();
        const amount = parseFloat((row[2] || "0").replace(/[^0-9.-]+/g, ""));
        const category = row[3] || "Uncategorized";

        if (params.month && !date.startsWith(params.month)) continue;

        if (params.date && !date.startsWith(params.date)) continue;

        if (params.merchant && !merchant.includes(params.merchant.toLowerCase())) continue;
        
        if (params.category && category.toLowerCase() !== params.category.toLowerCase()) continue;
        
        if (params.min_amount && amount < params.min_amount) continue;

        matches.push({date, merchant, amount, category});
        total += amount;
    }

    matches.sort((a, b) =>  b.date.localeCompare(a.date)); // Sort by date descending

    return {
        query_summary: `Found ${matches.length} transactions`,
        total_found: parseFloat(total.toFixed(2)),
        transaction_count: matches.length,
        transactions: matches.slice(0, limit),
    }
}