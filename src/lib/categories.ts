export const CATEGORIES = [
  "groceries",
  "restaurant",
  "transport",
  "housing",
  "utilities",
  "entertainment",
  "travel",
  "health",
  "shopping",
  "gifts",
  "other",
] as const;
export type Category = (typeof CATEGORIES)[number];
