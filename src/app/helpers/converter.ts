interface Currency {
  code: string;
  symbol: string;
  rateToNGN: number; // How many NGN = 1 unit of this currency
}

interface returnedValue {
    symbolWithText:string,
    amount: number
}

const SUPPORTED_CURRENCIES: Currency[] = [
  { code: 'NGN', symbol: '₦', rateToNGN: 1 },
  { code: 'USD', symbol: '$', rateToNGN: 1460 },
  { code: 'EUR', symbol: '€', rateToNGN: 1730 },
  { code: 'GBP', symbol: '£', rateToNGN: 2000 },
  { code: 'GHS', symbol: '₵', rateToNGN: 135 },
  { code: 'KES', symbol: 'KSh', rateToNGN: 11.2 },
  { code: 'HUF', symbol: 'Ft', rateToNGN: 4.44 }, // ~₦4.44 per 1 HUF :contentReference[oaicite:1]{index=1}
];


/**
 * Converts an amount in NGN to a target currency
 * @param amountNaira Amount in NGN
 * @param targetCurrencyCode Target currency code (e.g., 'USD')
 * @returns Converted amount with symbol
 */
export function convertFromNaira(amountNaira: number, targetCurrencyCode: string): returnedValue {
  const currency = SUPPORTED_CURRENCIES.find(c => c.code === targetCurrencyCode);
  if (!currency) throw new Error('Unsupported currency');

  if (currency.code === 'NGN') {
    return {
        symbolWithText: `₦${amountNaira.toLocaleString()}`,
        amount: amountNaira
    }
  } 

  // Round to nearest integer for currencies without subunits
  const converted = Math.round(amountNaira / currency.rateToNGN);
  return  {
    symbolWithText: `${currency.symbol}${converted}`,
    amount: converted
  }
}

// Example:
console.log(convertFromNaira(2000, 'HUF')); // Ft450
console.log(convertFromNaira(2000, 'USD')); // $1.37 (decimals allowed)


// Examples
console.log(convertFromNaira(2000, 'USD')); // "$2.63"
console.log(convertFromNaira(2000, 'EUR')); // "€2.41"
console.log(convertFromNaira(2000, 'NGN')); // "₦2,000"
