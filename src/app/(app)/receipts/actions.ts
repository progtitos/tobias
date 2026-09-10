"use server";

import { redirect } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { processReceiptUpload, confirmReceipt } from "@/services/receipts";

export type ReceiptUploadState = { error?: string } | undefined;

export async function uploadReceiptAction(_prev: ReceiptUploadState, formData: FormData): Promise<ReceiptUploadState> {
  const user = await requireOnboardedUser();
  const files = formData.getAll("photos").filter((f): f is File => f instanceof File && f.size > 0);

  if (files.length === 0) {
    return { error: "Selecione ao menos uma foto da nota." };
  }
  if (files.length > 5) {
    return { error: "Envie no máximo 5 fotos por nota." };
  }

  const images = await Promise.all(
    files.map(async (file) => ({ buffer: Buffer.from(await file.arrayBuffer()), mimeType: file.type || "image/jpeg" }))
  );

  const { receipt } = await processReceiptUpload(user.id, images);

  if (receipt.status === "FAILED") {
    return { error: receipt.errorMessage ?? "Não consegui ler essa nota." };
  }

  redirect(`/receipts/${receipt.id}/confirm`);
}

export type ConfirmReceiptState = { error?: string } | undefined;

export async function confirmReceiptAction(
  receiptId: string,
  _prev: ConfirmReceiptState,
  formData: FormData
): Promise<ConfirmReceiptState> {
  const user = await requireOnboardedUser();

  await confirmReceipt(user.id, receiptId, {
    merchant: String(formData.get("merchant") ?? "") || undefined,
    totalAmount: formData.get("totalAmount") ? Number(formData.get("totalAmount")) : undefined,
    categoryId: (formData.get("categoryId") as string) || undefined,
    date: String(formData.get("date") ?? "") || undefined,
  });

  redirect("/expenses");
}
