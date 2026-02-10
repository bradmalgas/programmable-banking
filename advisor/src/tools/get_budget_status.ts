import { GoogleSheetsClient } from "../sheets/googleSheetsClient";

interface BudgetRow {
    category: string;
    target: number;
    actual: number;
    remaining: number;
    status: 'OK' | 'OVER_BUDGET' | 'WARNING';
}

interface BudgetOverview {
    month: string;
    totalTarget: number;
    totalActual: number;
    totalRemaining: number;
    rows: BudgetRow[];
}

export async function getBudgetStatus(month: string): Promise<BudgetOverview> {
    const sheets = new GoogleSheetsClient();

    const [budgetValues, statValues] = await Promise.all([
        sheets.readRange('budget!A2:B17'),
        sheets.readRange('monthly_stats!E1:ZZ20'),
    ]);

    console.log("Budget Values:", budgetValues);
    console.log("Stat Values:", statValues);

    return {
        month,
        totalTarget: 0,
        totalActual: 0,
        totalRemaining: 0,
        rows: []
    };
}