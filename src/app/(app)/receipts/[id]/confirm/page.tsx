import { notFound } from "next/navigation";
import { requireOnboardedUser } from "@/lib/auth/guards";
import { getReceipt } from "@/services/receipts";
import { getUserCategories } from "@/services/categorization";
import { ConfirmReceiptClient } from "./ConfirmReceiptClient";

export default async function ConfirmReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireOnboardedUser();
  const data = await getReceipt(user.id, id);
  if (!data) notFound();

  const categories = await getUserCategories(user.id);

  return (
    <ConfirmReceiptClient
      receiptId={id}
      receipt={{
        merchant: data.receipt.merchant,
        totalAmount: data.receipt.totalAmount,
        purchaseDate: data.receipt.purchaseDate?.toISOString() ?? null,
        confidence: data.receipt.confidence ?? 0,
        imageUrls: data.receipt.imageUrls ?? [],
      }}
      items={data.items.map((i) => ({
        description: i.description,
        quantity: i.quantity,
        totalPrice: i.totalPrice,
        categoryGuess: i.categoryGuess,
      }))}
      categories={categories.filter((c) => c.type === "EXPENSE" && !c.parentId).map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
