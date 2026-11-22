// Money is whole rupees. Written the Indian way: 148000 is ₹1,48,000.

export function inr(n: number): string {
  const neg = n < 0
  const s = String(Math.round(Math.abs(n)))
  const last3 = s.slice(-3)
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',')
  return (neg ? '-' : '') + '₹' + (rest ? rest + ',' + last3 : last3)
}

/** Reads a typed amount: "1,500", "₹ 1500" and "1500.00" are all 1500. Empty or nonsense is null. */
export function parseAmount(raw: string): number | null {
  const s = (raw ?? '').replace(/[₹,\s]/g, '').replace(/^rs\.?/i, '')
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const n = Math.round(Number(s))
  return n <= 1000000 ? n : null
}
