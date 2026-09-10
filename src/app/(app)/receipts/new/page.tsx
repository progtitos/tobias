import { requireOnboardedUser } from "@/lib/auth/guards";
import { ReceiptUploadClient } from "./ReceiptUploadClient";

export default async function NewReceiptPage() {
  await requireOnboardedUser();
  return <ReceiptUploadClient />;
}
