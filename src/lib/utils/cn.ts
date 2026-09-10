import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge resolves conflicting Tailwind utilities (e.g. a component's default
// text color vs. a caller's override) by keeping the one that should win,
// instead of leaving both classes and letting CSS source order decide.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}