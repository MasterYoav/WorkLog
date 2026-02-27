import * as Crypto from 'expo-crypto';

export function sanitizeText(value: string, max = 120): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, max);
}

export function sanitizeNumericText(value: string, max = 20): string {
  return value.replace(/[^0-9]/g, '').slice(0, max);
}

export function sanitizeEmail(value: string): string {
  return sanitizeText(value, 254).toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isStrongPassword(value: string): boolean {
  return value.length >= 8;
}

export async function hashPassword(password: string): Promise<string> {
  return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
}

export async function passwordMatches(storedValue: string, providedPassword: string): Promise<boolean> {
  if (!storedValue) return false;
  const normalized = storedValue.trim();
  const providedHash = await hashPassword(providedPassword);
  return normalized === providedHash || normalized === providedPassword;
}
