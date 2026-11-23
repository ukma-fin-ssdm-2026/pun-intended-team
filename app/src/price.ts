// Written with the help of Claude

// Between the digits and before "₴", so a price never breaks over two lines.
const NBSP = ' ';

// A number as Ukrainian writes it, with a non-breaking space between thousands: 1200 is "1 200". Grouped by hand
// rather than with Intl, whose separator differs between Hermes, browsers and Node.
function hryvnias(amount: number): string {
  const digits = String(Math.trunc(amount));
  let grouped = '';
  for (let end = digits.length; end > 0; end -= 3) {
    const group = digits.slice(Math.max(0, end - 3), end);
    grouped = grouped ? `${group}${NBSP}${grouped}` : group;
  }
  return grouped;
}

// The price tag of an event card (Figma "1.3 Ціна") from the API's priceMin and priceMax, in whole hryvnias:
// - both null: the price is unknown, so no tag (undefined);
// - priceMin 0 and priceMax null or 0: "Безкоштовно";
// - priceMax null or equal to priceMin: one price, "450 ₴";
// - priceMax above priceMin: a range, "300–700 ₴", also from 0: "0–500 ₴".
// The dash is an en dash without spaces, and every space is non-breaking. The API never sends priceMax without
// priceMin, nor below it; if it did, the first would show no tag and the second priceMin alone.
export function priceLabel(priceMin: number | null, priceMax: number | null): string | undefined {
  if (priceMin === null) return undefined;
  if (priceMin === 0 && !priceMax) return 'Безкоштовно';
  if (priceMax === null || priceMax <= priceMin) return `${hryvnias(priceMin)}${NBSP}₴`;
  return `${hryvnias(priceMin)}–${hryvnias(priceMax)}${NBSP}₴`;
}
