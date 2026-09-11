import { z } from "zod";

// E.164: "+" followed by 8 to 15 digits, first digit 1-9 (no leading zero).
// Matches WhatsApp's own number format, so whatever the user types here is
// exactly what gets used as the "to" field for the Meta Cloud API.
const E164_REGEX = /^\+[1-9]\d{7,14}$/;

export const connectWhatsAppSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(E164_REGEX, "Use o formato internacional, com código do país. Ex: +5511999999999"),
});
