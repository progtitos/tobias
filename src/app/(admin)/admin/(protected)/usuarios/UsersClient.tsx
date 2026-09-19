"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, UserPlus } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Modal } from "@/components/ui/Modal";
import { Input, Label, FieldError } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { updateUserAction, deleteUserAction, createUserAction, type UpdateUserState } from "./actions";
import type { AdminUserRow } from "@/services/admin";

const ROLE_LABELS: Record<string, string> = { USER: "Usuário", PLANNER: "Planejador", ADMIN: "Admin" };
const PLAN_LABELS: Record<string, string> = {
  TRIAL: "Trial",
  TOBIAS: "Tobias",
  TOBIAS_PRO: "Tobias Pro",
  TOBIAS_FAMILIA: "Tobias Família",
  TOBIAS_PLANNER: "Tobias Planner",
};
const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  TRIALING: "Em trial",
  ACTIVE: "Ativo",
  PAST_DUE: "Pagamento atrasado",
  CANCELED: "Cancelado",
  EXPIRED: "Expirado",
};

/** yyyy-MM-dd pro `<input type="date">` a partir de um Date/ISO qualquer. */
function toDateInputValue(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

/** Campos de cargo/plano/status/trial compartilhados entre editar e criar usuário. */
function UserFieldsFragment({
  idPrefix,
  defaults,
}: {
  idPrefix: string;
  defaults: { role: string; subscriptionPlan: string; subscriptionStatus: string; trialEndsAt: string };
}) {
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`role-${idPrefix}`}>Cargo</Label>
          <Select id={`role-${idPrefix}`} name="role" defaultValue={defaults.role}>
            {Object.entries(ROLE_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`plan-${idPrefix}`}>Plano</Label>
          <Select id={`plan-${idPrefix}`} name="subscriptionPlan" defaultValue={defaults.subscriptionPlan}>
            {Object.entries(PLAN_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label htmlFor={`status-${idPrefix}`}>Status da assinatura</Label>
          <Select id={`status-${idPrefix}`} name="subscriptionStatus" defaultValue={defaults.subscriptionStatus}>
            {Object.entries(STATUS_LABELS).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor={`trial-${idPrefix}`}>Trial até</Label>
          <Input id={`trial-${idPrefix}`} name="trialEndsAt" type="date" defaultValue={defaults.trialEndsAt} required />
        </div>
      </div>
    </>
  );
}

function EditUserModal({ user, open, onClose }: { user: AdminUserRow; open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<UpdateUserState, FormData>(updateUserAction, undefined);

  // Fecha sozinho assim que o save der certo — sem isso o modal ficaria
  // aberto mostrando o formulário já salvo até o usuário fechar na mão.
  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title={`Editar ${user.name}`}>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="userId" value={user.id} />
        <div>
          <Label htmlFor={`name-${user.id}`}>Nome</Label>
          <Input id={`name-${user.id}`} name="name" defaultValue={user.name} required />
        </div>
        <div>
          <Label htmlFor={`email-${user.id}`}>E-mail</Label>
          <Input id={`email-${user.id}`} name="email" type="email" defaultValue={user.email} required />
        </div>
        <UserFieldsFragment
          idPrefix={user.id}
          defaults={{
            role: user.role,
            subscriptionPlan: user.subscriptionPlan,
            subscriptionStatus: user.subscriptionStatus,
            trialEndsAt: toDateInputValue(user.trialEndsAt),
          }}
        />
        <FieldError>{state?.error}</FieldError>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Salvar
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function CreateUserModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [state, formAction, pending] = useActionState<UpdateUserState, FormData>(createUserAction, undefined);
  // Data "agora + 15 dias" depende do relógio (impuro) — calculada uma vez
  // no inicializador preguiçoso do useState, não direto no corpo do
  // componente, pra não violar a regra de pureza de render.
  const [defaultTrialEndsAt] = useState(() => toDateInputValue(new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)));

  useEffect(() => {
    if (state?.success) onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Modal open={open} onClose={onClose} title="Adicionar usuário">
      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="new-name">Nome</Label>
          <Input id="new-name" name="name" required autoFocus />
        </div>
        <div>
          <Label htmlFor="new-email">E-mail</Label>
          <Input id="new-email" name="email" type="email" required />
        </div>
        <div>
          <Label htmlFor="new-password">Senha</Label>
          <Input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} />
        </div>
        <UserFieldsFragment
          idPrefix="new"
          defaults={{
            role: "USER",
            subscriptionPlan: "TRIAL",
            subscriptionStatus: "TRIALING",
            trialEndsAt: defaultTrialEndsAt,
          }}
        />
        <FieldError>{state?.error}</FieldError>
        <div className="flex items-center justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" loading={pending}>
            Criar usuário
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export function CreateUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)}>
        <UserPlus className="h-4 w-4" />
        Adicionar usuário
      </Button>
      {open && <CreateUserModal open={open} onClose={() => setOpen(false)} />}
    </>
  );
}

export function UserRowActions({ user }: { user: AdminUserRow }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-1 shrink-0">
      <IconButton label={`Editar ${user.name}`} onClick={() => setEditing(true)}>
        <Pencil className="h-4 w-4" />
      </IconButton>
      <IconButton label={`Excluir ${user.name}`} tone="danger" disabled={pending} onClick={() => setConfirmDelete(true)}>
        <Trash2 className="h-4 w-4" />
      </IconButton>

      {editing && <EditUserModal user={user} open={editing} onClose={() => setEditing(false)} />}

      <ConfirmDialog
        open={confirmDelete}
        title={`Excluir o usuário "${user.name}"?`}
        description="A conta é desativada e a pessoa é desconectada na hora. Isso não pode ser desfeito por aqui."
        pending={pending}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          startTransition(async () => {
            try {
              await deleteUserAction(user.id);
              setConfirmDelete(false);
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Falha ao excluir.");
            }
          });
        }}
      />
    </div>
  );
}
