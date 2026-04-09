"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

export async function setLocale(locale: string) {
  const validLocales = ["en", "es"];
  if (!validLocales.includes(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set("locale", locale, { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
