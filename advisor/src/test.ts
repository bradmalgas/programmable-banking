import { getBudgetStatus } from "./tools/get_budget_status";
import * as dotenv from "dotenv";
import { searchTransactions } from "./tools/search_transactions";
dotenv.config();

async function run() {
    console.log("Testing budget...");
    const budget = await getBudgetStatus({ month: "2026-02" });
    console.log(JSON.stringify(budget, null, 2));

    console.log("Testing search transactions...");
    const searchResults = await searchTransactions({
        month: "2028-02",
        merchant: "Apple",
        min_amount: 50,
        limit: 5
    });
    console.log(JSON.stringify(searchResults, null, 2));
}

run().catch(console.error);