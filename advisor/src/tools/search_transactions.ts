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

/**
 * Searches financial transactions from a Google Sheets data source based on specified criteria.
 * 
 * This function retrieves transaction data from a Google Sheets spreadsheet and filters
 * results based on the provided search parameters. Results are sorted by date in descending
 * order and limited to a maximum number of transactions.
 * 
 * @param params - Search parameters to filter transactions
 * @param params.merchant - Filter by merchant name (case-insensitive, partial match)
 * @param params.category - Filter by transaction category (case-insensitive, exact match)
 * @param params.month - Filter by month in YYYY-MM format (prefix match)
 * @param params.date - Filter by specific date in YYYY-MM-DD format (prefix match)
 * @param params.min_amount - Filter transactions with amount greater than or equal to this value
 * @param params.limit - Maximum number of transactions to return (default: 10)
 * 
 * @returns A promise that resolves to a SearchTransactionsResult containing:
 *   - query_summary: Human-readable summary of the search results
 *   - total_found: Sum of amounts for all matching transactions
 *   - transaction_count: Number of matching transactions
 *   - transactions: Array of matching transactions (limited by the limit parameter)
 * 
 * @throws Error if the Google Sheets client fails to initialize
 * 
 * @example
 * // Search for all grocery transactions in January 2026
 * const result = await searchTransactions({
 *   category: "Groceries",
 *   month: "2026-01",
 *   limit: 20
 * });
 * 
 * @example
 * // Find Starbucks transactions over R10
 * const result = await searchTransactions({
 *   merchant: "starbucks",
 *   min_amount: 10,
 *   limit: 5
 * });
 */
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