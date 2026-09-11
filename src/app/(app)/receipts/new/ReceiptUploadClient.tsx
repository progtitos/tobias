"use client";

import { useActionState, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { FieldError } from "@/components/ui/Input";
import { uploadReceiptAction, type ReceiptUploadState } from "../actions";
import { compressImageFile } from "@/lib/utils/image";

export function ReceiptUploadClient() {
  const [state, formAction, pending] = useActionState<ReceiptUploadState, FormData>(uploadReceiptAction, undefined);
  const [previews, setPreviews] = useState<{ url: string; file: File }[]>([]);
  const [compressing, setCompressing] = useState(false);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList) return;
    const files = Array.from(fileList).slice(0, 5 - previews.length);
    setCompressing(true);
    try {
      // Compressed in parallel, then added together — avoids a half-updated
      // grid while the user is mid-selection.
      const compressed = await Promise.all(files.map((file) => compressImageFile(file)));
      const next = compressed.map((file) => ({ url: URL.createObjectURL(file), file }));
      setPreviews((prev) => [...prev, ...next].slice(0, 5));
    } finally {
      setCompressing(false);
    }
  }

  function removePreview(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  return (
    <div className="flex-1 bg-brand-950 px-5 py-6">
      <div className="max-w-lg mx-auto w-full">
      <h1 className="font-sans font-bold text-2xl text-onbrand mb-1">Fotografar nota</h1>
      <p className="text-sm text-onbrand/55 mb-6">
        Tire uma foto da nota fiscal ou comprovante. Para notas grandes, envie até 5 fotos: o Tobias
        consolida tudo como uma única compra.
      </p>

      <form action={formAction}>
        {previews.length === 0 ? (
          <label className="flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-gold-400/40 bg-brand-900/40 py-16 cursor-pointer hover:bg-brand-900/70 transition-colors">
            <Camera className="h-10 w-10 text-gold-400" />
            <span className="text-sm font-medium text-onbrand">Toque para fotografar ou escolher</span>
            <input
              type="file"
              name="photos-input"
              accept="image/*"
              capture="environment"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
          </label>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              {previews.map((p, i) => (
                <div key={p.url} className="relative aspect-square rounded-xl overflow-hidden border border-black/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white rounded px-1.5">
                    {i + 1}/{previews.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePreview(i)}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5 text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              {previews.length < 5 && (
                <label className="flex items-center justify-center aspect-square rounded-xl border-2 border-dashed border-white/15 cursor-pointer hover:bg-white/5">
                  <Camera className="h-6 w-6 text-onbrand/55" />
                  <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                </label>
              )}
            </div>
            <HiddenFileInputSync files={previews.map((p) => p.file)} />
          </div>
        )}

        <FieldError>{state?.error}</FieldError>

        {previews.length > 0 && (
          <Button type="submit" className="w-full mt-5" loading={pending} disabled={pending || compressing}>
            {pending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Lendo nota com IA...
              </>
            ) : compressing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Preparando foto...
              </>
            ) : (
              "Continuar"
            )}
          </Button>
        )}
      </form>

      <Card className="mt-8">
        <CardContent className="py-4 text-xs text-onbrand/55">
          Sem uma nota em mãos? Você também pode registrar o gasto direto pelo chat, dizendo algo como
          &quot;gastei 80 reais no mercado&quot;, ou lançar manualmente na tela de Gastos.
        </CardContent>
      </Card>
      </div>
    </div>
  );
}

/**
 * File inputs can't be programmatically set for security reasons, so the
 * visible inputs above only ever hold their own single/most-recent
 * selection. This hidden input carries the accumulated set of File objects
 * (via a DataTransfer buffer) under the field name the server action reads.
 */
function HiddenFileInputSync({ files }: { files: File[] }) {
  const dt = new DataTransfer();
  files.forEach((f) => dt.items.add(f));
  return (
    <input
      type="file"
      name="photos"
      multiple
      className="hidden"
      ref={(el) => {
        if (el) el.files = dt.files;
      }}
    />
  );
}
