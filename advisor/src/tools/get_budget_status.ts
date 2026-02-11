import { GoogleSheetsClient } from "../sheets/googleSheetsClient";

type BudgetStatus = "OK" | "OVER_BUDGET" | "WARNING";

interface BudgetStatusRequest {
  month: string;
}

interface BudgetItem {
  category: string;
  target: number;
  actual: number;
  remaining: number;
  status: BudgetStatus;
}

interface BudgetOverview {
  month: string;
  totalTarget: number;
  totalActual: number;
  totalRemaining: number;
  categorizedSpending: BudgetItem[];
}

/**
 * Retrieves the budget status for a specified month from Google Sheets.
 * 
 * Fetches budget targets from the "budget" sheet and actual spending data from the 
 * "monthly_stats" sheet, then calculates remaining budget and status for each category.
 * 
 * @param month - The month name to retrieve budget status for in format YYYY_MM (must match a column header in monthly_stats sheet)
 * @returns A promise that resolves to a BudgetOverview containing:
 *   - month: The requested month
 *   - totalTarget: Sum of all budget targets
 *   - totalActual: Sum of all actual spending
 *   - totalRemaining: Difference between total target and total actual
 *   - categorizedSpending: Array of BudgetItem objects with category, target, actual, remaining, and status
 * 
 * @throws {Error} If the specified month is not found in the monthly_stats sheet
 * 
 * @example
 * ```typescript
 * const budgetStatus = await getBudgetStatus("2026-01");
 * console.log(budgetStatus.totalRemaining); // Budget remaining for January
 * ```
 */
export async function getBudgetStatus(req: BudgetStatusRequest): Promise<BudgetOverview> {
  const month = req.month;
  let sheets: GoogleSheetsClient;
  try {
    sheets = new GoogleSheetsClient();
  } catch (error) {
    throw new Error(`Failed to instantiate GoogleSheetsClient: ${error instanceof Error ? error.message : String(error)}`);
  }

  const [budgetRows, monthlyStatsData] = await Promise.all([
    sheets.readRange("budget!A2:B17"),
    sheets.readRange("monthly_stats!E1:ZZ20"),
  ]);

  const budgetTargetsMap = new Map<string, number>();
  budgetRows.forEach((budgetRow) => {
    budgetTargetsMap.set(budgetRow[0], parseFloat(budgetRow[1] || "0"));
  });
  const actualSpendingMap = new Map<string, number>();
  const monthHeaders = monthlyStatsData[0] || [];
  const requestedMonthColIndex = monthHeaders.indexOf(month);

  if (requestedMonthColIndex === -1) {
    throw new Error(`Month ${month} not found in monthly_stats sheet`);
  }

  monthlyStatsData.slice(1).forEach((statRow) => {
    const category = statRow[0];
    const actual = parseFloat(statRow[requestedMonthColIndex]) || 0;
    if (category) actualSpendingMap.set(category, actual);
  });

  const rows: BudgetItem[] = [];
  let totalTarget = 0;
  let totalActual = 0;

  for (const [category, target] of budgetTargetsMap.entries()) {
    const actual = actualSpendingMap.get(category) || 0;
    const remaining = target - actual;

    let status: BudgetStatus = "OK";
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
    categorizedSpending: rows,
  };
}
