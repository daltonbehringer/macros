import { cmToInch, inchToCm, kgToLb, lbToKg } from "@macros/shared";

/** Format cm as feet'inches" for imperial users. */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalInches = cmToInch(cm);
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return inchToCm(feet * 12 + inches);
}

export function roundDisplay(n: number, places = 1): string {
  if (Number.isNaN(n)) return "";
  return places === 0
    ? String(Math.round(n))
    : (Math.round(n * 10 ** places) / 10 ** places).toString();
}

export { kgToLb, lbToKg, cmToInch, inchToCm };
