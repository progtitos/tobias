import { requireOnboardedUser } from "@/lib/auth/guards";
import { listBankAccounts } from "@/services/bankAccounts";
import { listCreditCards } from "@/services/creditCards";
import { computeNetWorth } from "@/services/aggregations";
import { ContaClient } from "./ContaClient";

export default async function ContaPage() {
  const user = await requireOnboardedUser();
  const [accounts, creditCards, netWorth] = await Promise.all([
    listBankAccounts(user.id),
    listCreditCards(user.id),
    computeNetWorth(user.id),
  ]);

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
      creditCards={creditCards.map((c) => ({
        id: c.id,
        bankAccountId: c.bankAccountId,
        nickname: c.nickname,
        brand: c.brand,
        lastFourDigits: c.lastFourDigits,
        limitAmount: c.limitAmount,
      }))}
      totalInvested={netWorth.investedAssets}
    />
  );
}
