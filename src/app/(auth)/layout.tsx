import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-brand-950 px-6 py-12">
      <Link href="/" className="flex items-center gap-2.5 mb-8">
        <Image src="/logo-transparent.png" alt="Tobias" width={36} height={36} />
        <span className="font-serif text-xl text-cream-50">Tobias</span>
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </div>
  );
}
