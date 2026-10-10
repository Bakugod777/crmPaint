// Single money formatter for the whole app: en-US, USD, always 2 decimals -> "$3,140.00".
const USD = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function formatUSD(n: unknown): string {
  const v = Number(n)
  return USD.format(Number.isFinite(v) ? v : 0)
}
