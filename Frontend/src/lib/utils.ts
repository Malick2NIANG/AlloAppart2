import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: string | number, currency = 'XOF'): string {
  return new Intl.NumberFormat('fr-SN', { style: 'currency', currency }).format(Number(amount));
}

export function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('fr-SN', { dateStyle: 'medium' }).format(new Date(dateStr));
}
