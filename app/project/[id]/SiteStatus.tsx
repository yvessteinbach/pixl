"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function SiteStatus({ siteId, initialStatus }: { siteId: string, initialStatus: string }) {
  const [status, setStatus] = useState(initialStatus);
  const router = useRouter();

  useEffect(() => {
    if (status !== "BUILDING") return;

    const interval = setInterval(async () => {
      const res = await fetch(`/api/site?id=${siteId}`);
      if (res.ok) {
        const data = await res.json();
        if (data.site.status !== "BUILDING") {
          setStatus(data.site.status);
          router.refresh(); // Tells Next.js Server Components to re-fetch!
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [siteId, status, router]);

  if (status === "BUILDING") {
    return (
      <Badge variant="warning" className="gap-2">
        <Loader2 className="size-3 animate-spin" /> Building
      </Badge>
    );
  }

  if (status === "FAILED") {
    return (
      <Badge variant="destructive">Failed</Badge>
    );
  }

  return (
    <Badge variant="success">Ready</Badge>
  );
}
