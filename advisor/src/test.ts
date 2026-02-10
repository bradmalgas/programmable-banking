import { getBudgetStatus } from "./tools/get_budget_status";
import * as dotenv from "dotenv";
dotenv.config();

async function run() {
    console.log("Fetching budget...");
    const budget = await getBudgetStatus("2023-03");
    console.log(JSON.stringify(budget, null, 2));
}

run().catch(console.error);