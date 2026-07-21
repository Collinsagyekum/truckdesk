/**
 * Calculates fuel cost based on miles, diesel price, and fuel efficiency (mpg).
 */
export function calculateFuelCost(miles: number, dieselPrice: number, mpg: number = 7): number {
  if (mpg <= 0) return 0;
  return (miles / mpg) * dieselPrice;
}

export interface Expense {
  amount: number;
}

/**
 * Calculates net profit by subtracting total expenses from the rate.
 */
export function calculateNetProfit(rate: number, expenses: Expense[]): number {
  const totalExpenses = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  return rate - totalExpenses;
}

/**
 * Calculates rate per mile (RPM). Handles miles === 0 case.
 */
export function calculateRatePerMile(rate: number, miles: number): number {
  if (miles <= 0) return 0;
  return rate / miles;
}

/**
 * Returns AI recommendation based on RPM and average RPM.
 * - 'go' if rpm >= avgRpm * 0.95
 * - 'counter' if rpm >= avgRpm * 0.80
 * - 'pass' otherwise
 */
export function getAIRecommendation(rpm: number, avgRpm: number): 'go' | 'counter' | 'pass' {
  if (rpm >= avgRpm * 0.95) {
    return 'go';
  }
  if (rpm >= avgRpm * 0.80) {
    return 'counter';
  }
  return 'pass';
}
