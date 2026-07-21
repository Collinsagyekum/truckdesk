/**
 * Calculates Self-Employment (SE) tax: 15.3% of 92.35% of net profit.
 */
export function calculateSETax(netProfit: number): number {
  if (netProfit <= 0) return 0;
  return netProfit * 0.9235 * 0.153;
}

/**
 * Calculates SEP IRA contribution: 20% of net self-employment income, capped at $69,000.
 * Net self-employment income is net profit adjusted by the self-employment tax deduction (50% of SE tax).
 */
export function calculateSEPContribution(netProfit: number): number {
  if (netProfit <= 0) return 0;
  const seTax = calculateSETax(netProfit);
  const netSEIncome = netProfit - (seTax * 0.5);
  return Math.min(Math.max(0, netSEIncome * 0.20), 69000);
}

/**
 * Calculates Solo 401(k) contribution:
 * Employee contribution ($23,000) + Employer contribution (25% of net profit), capped at $69,000.
 */
export function calculateSolo401kContribution(netProfit: number): number {
  if (netProfit <= 0) return 0;
  const employeeContrib = Math.min(netProfit, 23000);
  const employerContrib = netProfit * 0.25;
  return Math.min(employeeContrib + employerContrib, 69000);
}

/**
 * Calculates IRS standard per diem for truck drivers (e.g., $69/day).
 */
export function calculatePerDiem(daysAway: number): number {
  return Math.max(0, daysAway) * 69;
}

/**
 * Returns the estimated tax due date for a specific quarter and year.
 * Due dates:
 * - Q1: Apr 15, year
 * - Q2: Jun 15, year
 * - Q3: Sep 15, year
 * - Q4: Jan 15, year + 1
 */
export function getQuarterlyDueDate(quarter: number, year: number): string {
  switch (quarter) {
    case 1:
      return `Apr 15, ${year}`;
    case 2:
      return `Jun 15, ${year}`;
    case 3:
      return `Sep 15, ${year}`;
    case 4:
      return `Jan 15, ${year + 1}`;
    default:
      return '';
  }
}

/**
 * Returns the current quarter (1-4) based on the system's current date.
 */
export function getCurrentQuarter(): number {
  const month = new Date().getMonth(); // 0-11 where 0 is Jan
  return Math.floor(month / 3) + 1;
}
