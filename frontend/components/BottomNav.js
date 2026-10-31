"use client";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Activity, PlusCircle, ChartNoAxesCombined } from "lucide-react";
const links = [
  { href: "/", label: "Mi día", Icon: Activity },
  { href: "/registro", label: "Registrar", Icon: PlusCircle },
  { href: "/historial", label: "Historial", Icon: ChartNoAxesCombined },
];
function Pending() {
  const { pending } = useLinkStatus();
  return pending ? (
    <span
      className="absolute bottom-1 size-1 rounded-full bg-acento"
      aria-hidden="true"
    />
  ) : null;
}
export default function BottomNav() {
  const path = usePathname();
  if (path === "/pin") return null;
  return (
    <nav
      data-nav-principal
      className="fixed inset-x-0 bottom-0 z-50 border-t border-borde bg-fondo/95 backdrop-blur"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegación principal"
    >
      <div className="mx-auto flex max-w-3xl">
        {links.map(({ href, label, Icon }) => (
          <Link
            key={href}
            href={href}
            aria-current={path === href ? "page" : undefined}
            className={
              "relative flex min-h-18 flex-1 flex-col items-center justify-center gap-1 text-sm font-medium " +
              (path === href ? "text-acento" : "text-tenue")
            }
          >
            <Icon size={22} aria-hidden="true" />
            {label}
            <Pending />
          </Link>
        ))}
      </div>
    </nav>
  );
}
