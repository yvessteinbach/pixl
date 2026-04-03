"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Rocket, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type PendingDeployActionsProps = {
  siteId: string;
  commitUrl: string | null;
};

export default function PendingDeployActions({
  siteId,
  commitUrl,
}: PendingDeployActionsProps) {
  const [deploying, setDeploying] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [hidden, setHidden] = useState(false);
  const router = useRouter();

  const handleDeploy = async () => {
    setDeploying(true);
    try {
      const res = await fetch("/api/site/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ siteId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error || "Failed to start deploy");
        return;
      }

      setHidden(true);
      router.refresh();
    } finally {
      setDeploying(false);
    }
  };

  const handleDecline = async () => {
    setDeclining(true);
    try {
      const res = await fetch(`/api/site/deploy?siteId=${siteId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        alert(body?.error || "Failed to decline deploy");
        return;
      }

      setHidden(true);
      router.refresh();
    } finally {
      setDeclining(false);
    }
  };

  if (hidden) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {commitUrl ? (
        <Button asChild variant="outline" size="sm">
          <a href={commitUrl} target="_blank" rel="noreferrer">
            <ExternalLink className="size-4" />
            Review on GitHub
          </a>
        </Button>
      ) : null}
      <Button
        onClick={handleDecline}
        disabled={deploying || declining}
        variant="outline"
        size="sm"
      >
        <X className="size-4" />
        {declining ? "Declining..." : "Decline"}
      </Button>
      <Button
        onClick={handleDeploy}
        disabled={deploying || declining}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
        size="sm"
      >
        <Rocket className="size-4" />
        {deploying ? "Starting..." : "Deploy now"}
      </Button>
    </div>
  );
}
