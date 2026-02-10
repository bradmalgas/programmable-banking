import { GoogleSheetsClient } from "../sheets/googleSheetsClient";

interface BudgetRow {
  category: string;
  target: number;
  actual: number;
  remaining: number;
  status: "OK" | "OVER_BUDGET" | "WARNING";
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
    sheets.readRange("budget!A2:B17"),
    sheets.readRange("monthly_stats!E1:ZZ20"),
  ]);
  const targetsMap = new Map<string, number>();
  budgetValues.forEach((row) => {
    targetsMap.set(row[0], parseFloat(row[1] || "0"));
  });
  const actualsMap = new Map<string, number>();
  const headerRow = statValues[0] || [];
  const monthColIndex = headerRow.indexOf(month);

  if (monthColIndex === -1) {
    throw new Error(`Month ${month} not found in monthly_stats sheet`);
  }

  statValues.slice(1).forEach((row) => {
    const category = row[0];
    const actual = parseFloat(row[monthColIndex]) || 0;
    if (category) actualsMap.set(category, actual);
  });

  const rows: BudgetRow[] = [];
  let totalTarget = 0;
  let totalActual = 0;

  for (const [category, target] of targetsMap.entries()) {
    const actual = actualsMap.get(category) || 0;
    const remaining = target - actual;

    let status: BudgetRow["status"] = "OK";
    if (remaining < 0) status = "OVER_BUDGET";
    else if (remaining < target * 0.2) status = "WARNING";

    totalTarget += target;
    totalActual += actual;

    rows.push({ category, target, actual, remaining, status });
  }

  return {
    month,
    totalTarget: totalTarget,
    totalActual: totalActual,
    totalRemaining: totalTarget - totalActual,
    rows,
  };
}
