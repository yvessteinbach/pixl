import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  return (
    <Button
      asChild
      size="sm"
      className="bg-primary text-primary-foreground hover:bg-primary/90"
    >
      <Link href="/plans">
        Upgrade Plan
        <ArrowUpRight className="size-4" />
      </Link>
    </Button>
  );
}
