"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Rocket, BarChart2, LayoutGrid, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Projects", icon: LayoutGrid, exact: true },
  { href: "/deployments", label: "Deployments", icon: Rocket, exact: false },
  { href: "/usage", label: "Usage", icon: BarChart2, exact: false },
  { href: "/plans", label: "Plans", icon: CreditCard, exact: false },
];

export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="nav-tabs flex flex-col">
      {tabs.map(({ href, label, icon: Icon, exact }) => {
        const isProjectsSection = href === "/" && (pathname === "/" || pathname.startsWith("/project/"));
        const isActive = exact ? isProjectsSection : pathname.startsWith(href);
        return (
          <Link
            key={label}
            href={href}
            className={cn(
              "group inline-flex items-center gap-3 py-2 text-sm font-medium transition-colors text-muted-foreground hover:text-foreground",
              isActive && "text-foreground"
            )}
            title={label}
            aria-label={label}
          >
            <Icon className="size-4" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
