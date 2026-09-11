import { requireOnboardedUser } from "@/lib/auth/guards";
import { listBankAccounts } from "@/services/bankAccounts";
import { ContaClient } from "./ContaClient";

export default async function ContaPage() {
  const user = await requireOnboardedUser();
  const accounts = await listBankAccounts(user.id);

  return (
    <ContaClient
      accounts={accounts.map((a) => ({
        id: a.id,
        name: a.name,
        bankName: a.bankName,
        type: a.type,
        balance: a.balance,
        isActive: a.isActive,
      }))}
    />
  );
}
