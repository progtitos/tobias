import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// twMerge resolves conflicting Tailwind utilities (e.g. a component's default
// `text-ink-900` vs. a caller's override `text-onbrand`) by keeping the last
// one that wins by Tailwind's own precedence rules, instead of leaving both
// classes in the DOM and letting CSS source order decide unpredictably.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
