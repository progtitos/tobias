import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-brand-950 px-6 py-12">
      <Link href="/" className="flex flex-col items-center gap-3 mb-8">
        <Image src="/logo-transparent.png" alt="Tobias" width={160} height={160} priority />
        <span className="font-display text-2xl text-onbrand">Tobias</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
