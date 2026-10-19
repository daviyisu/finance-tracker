import { type KeypadKey, applyKey, displayInput, formatMoney, formatSignedMoney, inputToCents } from './money';

const type = (keys: KeypadKey[]) => keys.reduce((acc, k) => applyKey(acc, k), '');

describe('money', () => {
  it('formatea con separador de miles y el símbolo pegado', () => {
    expect(formatMoney(115770, 'EUR')).toBe('1.157,70 €');
    expect(formatMoney(1240, 'EUR')).toBe('12,40 €');
    expect(formatMoney(0, 'USD')).toBe('0,00 $');
  });

  it('formatea con signo', () => {
    expect(formatSignedMoney(-1240, 'EUR')).toBe('−12,40 €');
    expect(formatSignedMoney(200000, 'EUR')).toBe('+2.000,00 €');
  });

  it('escribe importes con el teclado', () => {
    expect(type(['1', '2', ',', '4'])).toBe('12,4');
    expect(type([',', '5'])).toBe('0,5');
    expect(type(['0', '0', '7'])).toBe('7');
    expect(type(['1', ',', '2', '3', '4'])).toBe('1,23');
    expect(type(['1', ',', ','])).toBe('1,');
    expect(type(['1', '2', 'del'])).toBe('1');
    expect(type(['del'])).toBe('');
    expect(type(['1', '2', '3', '4', '5', '6', '7', '8'])).toBe('1234567');
  });

  it('convierte el texto a céntimos', () => {
    expect(inputToCents('')).toBe(0);
    expect(inputToCents('0,')).toBe(0);
    expect(inputToCents('12,4')).toBe(1240);
    expect(inputToCents('12,45')).toBe(1245);
    expect(inputToCents('1234')).toBe(123400);
  });

  it('muestra el texto agrupado', () => {
    expect(displayInput('')).toBe('0');
    expect(displayInput('1234,5')).toBe('1.234,5');
    expect(displayInput('0,')).toBe('0,');
  });
});
