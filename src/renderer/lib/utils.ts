// abstract: Small renderer utility helpers shared by React components.
// out_of_scope: Electron IPC, application state mutation, and visual design tokens.

import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
