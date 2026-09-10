import { z } from "zod";

export const signupSchema = z.object({
  name: z.string().trim().min(2, "Digite seu nome completo").max(120),
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido"),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido"),
  password: z.string().min(1, "Digite sua senha"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("Digite um e-mail válido"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres"),
});
