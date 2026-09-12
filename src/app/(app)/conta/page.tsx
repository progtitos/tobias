import { requireOnboardedUser } from "@/lib/auth/guards";
import { listBankAccounts } from "@/services/bankAccounts";
import { computeNetWorth } from "@/services/aggregations";
import { ContaClient } from "./ContaClient";

export default async function ContaPage() {
  const user = await requireOnboardedUser();
  const [accounts, netWorth] = await Promise.all([listBankAccounts(user.id), computeNetWorth(user.id)]);

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
      totalInvested={netWorth.investedAssets}
    />
  );
}
