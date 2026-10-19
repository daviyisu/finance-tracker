import type { CurrencyCode } from './models';

const SYMBOL: Record<CurrencyCode, string> = { EUR: '€', USD: '$' };
const NBSP = ' ';
const MAX_INTEGER_DIGITS = 7;

const groupThousands = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** 115770 → "1.157,70". Siempre agrupa miles, también con cuatro cifras. */
function formatNumber(cents: number): string {
  const abs = Math.abs(Math.round(cents));
  const integer = groupThousands(String(Math.floor(abs / 100)));
  const decimals = String(abs % 100).padStart(2, '0');
  return `${cents < 0 ? '−' : ''}${integer},${decimals}`;
}

export function currencySymbol(currency: CurrencyCode): string {
  return SYMBOL[currency];
}

/** 115770 → "1.157,70 €". El símbolo nunca se separa del número. */
export function formatMoney(cents: number, currency: CurrencyCode): string {
  return `${formatNumber(cents)}${NBSP}${SYMBOL[currency]}`;
}

/** Igual que formatMoney pero con signo: "−12,40 €" / "+2.000,00 €". */
export function formatSignedMoney(cents: number, currency: CurrencyCode): string {
  const sign = cents < 0 ? '−' : '+';
  return sign + formatMoney(Math.abs(cents), currency);
}

export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | ',' | 'del';

/**
 * Aplica una pulsación del teclado al texto del importe ("12,4").
 * Máximo dos decimales, una coma y siete cifras enteras.
 */
export function applyKey(input: string, key: KeypadKey): string {
  if (key === 'del') {
    return input.slice(0, -1);
  }
  if (key === ',') {
    if (input.includes(',')) return input;
    return input === '' ? '0,' : input + ',';
  }
  const [integer, decimals] = input.split(',');
  if (decimals !== undefined) {
    return decimals.length >= 2 ? input : input + key;
  }
  if (integer === '0') return key;
  if (integer.length >= MAX_INTEGER_DIGITS) return input;
  return input + key;
}

/** "12,4" → 1240. Texto vacío o "0," → 0. */
export function inputToCents(input: string): number {
  if (!input) return 0;
  const [integer, decimals = ''] = input.split(',');
  return Number(integer || '0') * 100 + Number((decimals + '00').slice(0, 2));
}

/** Texto que se muestra mientras se escribe: "1234,5" → "1.234,5". */
export function displayInput(input: string): string {
  if (!input) return '0';
  const [integer, decimals] = input.split(',');
  const grouped = groupThousands(integer || '0');
  return decimals === undefined ? grouped : `${grouped},${decimals}`;
}

/**
 * Importe escrito a mano ("92", "92,5", "1.200,50", "92.5") → céntimos.
 * Devuelve null si no es un número positivo válido.
 */
export function parseAmount(text: string): number | null {
  let value = text.replace(/\s|€|\$/g, '');
  if (!value) return null;
  if (value.includes(',')) {
    value = value.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(value)) {
    value = value.replace(/\./g, ''); // "1.200" = mil doscientos
  }
  if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return cents > 0 ? cents : null;
}

/** Céntimos → texto editable: 9200 → "92", 9250 → "92,50". */
export function centsToInput(cents: number): string {
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',');
}
