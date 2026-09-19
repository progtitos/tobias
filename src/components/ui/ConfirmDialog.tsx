"use client";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmDialogProps {
  open: boolean;
  /** Nomeia o item afetado, ex.: `Excluir a conta "Nubank"?` */
  title: string;
  /** Explica a consequência em uma frase, ex.: `Isso não pode ser desfeito.` */
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Especialização do `Modal` para toda ação destrutiva/irreversível — substitui
 * o `window.confirm()` nativo do navegador. Ação destrutiva é sempre
 * `variant="danger"` à direita, cancelar é `outline` à esquerda (nunca o
 * inverso — perigo à esquerda convida ao clique errado). Fecha só por Esc ou
 * pelas duas ações explícitas, nunca por clique no backdrop.
 *
 * Ver `design-system-tobias.md`, seção 13 (variante ConfirmDialog).
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Excluir",
  cancelLabel = "Cancelar",
  pending = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} closeOnBackdropClick={false}>
      <p className="text-sm text-onbrand/70 mb-5">{description}</p>
      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {cancelLabel}
        </Button>
        <Button type="button" variant="danger" onClick={onConfirm} loading={pending}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
