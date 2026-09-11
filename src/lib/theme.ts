import { cookies } from "next/headers";

// The logged-in product's light/dark preference — NOT a site-wide setting.
// See the "THEME MODEL" note at the top of src/app/globals.css for why this
// only ever reaches AppShell's own root element and never <html>: the
// marketing/legal pages have one fixed dark look and are never meant to
// read this cookie at all.
export const THEME_COOKIE = "tobias-theme";
export type Theme = "light" | "dark";

export async function getTheme(): Promise<Theme> {
  const store = await cookies();
  return store.get(THEME_COOKIE)?.value === "dark" ? "dark" : "light";
}
