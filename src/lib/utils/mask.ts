/** Masks a CPF for display: keeps the first 3 and last 2 digits (e.g. 123.***.**9-01 style redaction). */
export function maskCPF(cpf: string | null | undefined): string | null {
  if (!cpf) return null;
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return "***.***.***-**";
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

/** Masks a phone number for display, keeping the country/area code and last 2 digits. */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "****";
  return `${digits.slice(0, digits.length - 6)}****${digits.slice(-2)}`;
}
