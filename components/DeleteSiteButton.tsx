"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function DeleteSiteButton({ siteId }: { siteId: string }) {
  const [step, setStep] = useState<"idle" | "confirm" | "loading">("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleDelete = async () => {
    setStep("loading");
    setError(null);
    try {
      const res = await fetch(`/api/deploy?siteId=${siteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        setError(body.error || "Failed to delete site");
        setStep("idle");
      }
    } catch {
      setError("Network error — please try again");
      setStep("idle");
    }
  };

  if (step === "confirm") {
    return (
      <div className="mt-3 flex flex-col gap-2">
        <p className="text-sm text-destructive">
          This will stop the container and delete all files. Are you sure?
        </p>
        <div className="flex gap-2">
          <Button
            onClick={handleDelete}
            className="flex-1"
            size="sm"
            variant="destructive"
          >
            <Trash2 className="size-4" /> Yes, Destroy
          </Button>
          <Button
            onClick={() => setStep("idle")}
            className="flex-1"
            variant="outline"
            size="sm"
          >
            Cancel
          </Button>
        </div>
        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </div>
    );
  }

  if (step === "loading") {
    return (
      <Button disabled variant="outline" size="sm" className="mt-3 w-full">
        <Trash2 className="size-4" /> Destroying...
      </Button>
    );
  }

  return (
    <>
      <Button
        onClick={() => setStep("confirm")}
        variant="outline"
        size="sm"
        className="mt-3 w-full text-destructive"
      >
        <Trash2 className="size-4" /> Destroy
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </>
  );
}
