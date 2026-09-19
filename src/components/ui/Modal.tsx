"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { IconButton } from "@/components/ui/IconButton";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** false só para diálogos de confirmação destrutiva — exige clique explícito numa das ações. */
  closeOnBackdropClick?: boolean;
  className?: string;
}

/**
 * `Modal`/`Dialog` base do design system: `role="dialog"` + `aria-modal` +
 * `aria-labelledby`, trap de foco, foco move pra dentro ao abrir e volta pro
 * elemento que abriu ao fechar, fecha com Esc/backdrop/botão explícito.
 * Ver `design-system-tobias.md`, seção 13.
 */
export function Modal({ open, onClose, title, children, closeOnBackdropClick = true, className }: ModalProps) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const dialog = dialogRef.current;
    const focusable = dialog?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    (focusable?.[0] ?? dialog)?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = originalOverflow;
      previousFocusRef.current?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // React portals ainda borbulham eventos pela árvore de componentes
        // (não pela árvore real do DOM) — sem isso, um clique aqui dentro
        // chegaria a um onClick de "fechar ao clicar fora" de um modal
        // ancestral (ex.: este Modal aberto de dentro de outro modal
        // hand-rolled), fechando os dois de uma vez.
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "relative w-full max-w-lg rounded-2xl bg-brand-800 p-5",
          "shadow-[0_20px_48px_-16px_rgba(0,0,0,0.6)]",
          "focus:outline-none",
          className
        )}
      >
        <div className="flex items-start justify-between gap-3 mb-3">
          <h2 id={titleId} className="font-sans font-semibold text-lg text-onbrand">
            {title}
          </h2>
          <IconButton label="Fechar" onClick={onClose} className="h-9 w-9 -mr-1.5 -mt-1.5">
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
