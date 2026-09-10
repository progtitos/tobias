import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-cream-50 px-6 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <Image src="/logo.png" alt="Tobias" width={36} height={36} className="rounded-full" />
        <span className="font-serif text-xl text-brand-950">Tobias</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
