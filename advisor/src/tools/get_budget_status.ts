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

    const actualsMap = new Map<string, number>();
    const headerRow = statValues[0] || [];
    const monthColIndex = headerRow.indexOf(month);

    if (monthColIndex === -1) {
        throw new Error(`Month ${month} not found in monthly_stats sheet`);
    }

    statValues.slice(1).forEach(row => {
        const category = row[0];
        const actual = parseFloat(row[monthColIndex]) || 0;
        if (category) actualsMap.set(category, actual);
    });

    return {
        month,
        totalTarget: 0,
        totalActual: 0,
        totalRemaining: 0,
        rows: []
    };
}