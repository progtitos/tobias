"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { deleteAccount } from "@/services/account";
import { destroySession } from "@/lib/auth/session";

export async function deleteAccountAction() {
  const user = await requireUser();
  await deleteAccount(user.id);
  await destroySession();
  redirect("/");
}
