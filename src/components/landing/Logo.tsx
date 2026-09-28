import Image from "next/image";
import { cn } from "@/lib/utils/cn";

interface LogoProps {
  className?: string;
  /** Altura do mascote em pixels */
  size?: number;
  withWordmark?: boolean;
}

export default function Logo({ className, size = 34, withWordmark = true }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Image
        src="/logo-transparent.png"
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="object-contain drop-shadow-[0_2px_10px_rgba(240,153,47,0.22)]"
        style={{ height: size, width: "auto" }}
      />
      {withWordmark && (
        <span className="font-display text-[1.15rem] font-semibold tracking-tight text-cream-50">Tobias</span>
      )}
    </span>
  );
}
