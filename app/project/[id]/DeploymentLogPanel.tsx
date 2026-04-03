"use client";

import { useEffect, useState } from "react";

type DeploymentLogPanelProps = {
  deploymentId: string;
  initialContent: string;
  initialStatus: string;
};

export default function DeploymentLogPanel({
  deploymentId,
  initialContent,
  initialStatus,
}: DeploymentLogPanelProps) {
  const [content, setContent] = useState(initialContent);
  const [status, setStatus] = useState(initialStatus);

  useEffect(() => {
    if (status !== "BUILDING") {
      return;
    }

    const interval = setInterval(async () => {
      const res = await fetch(`/api/deployment/logs?deploymentId=${deploymentId}`);
      if (!res.ok) {
        return;
      }

      const data = (await res.json()) as { content?: string; status?: string };
      setContent(data.content ?? "");
      setStatus(data.status ?? status);
    }, 2000);

    return () => clearInterval(interval);
  }, [deploymentId, status]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Deployment logs</p>
        <p className="text-xs text-muted-foreground">
          {status === "BUILDING" ? "Live" : "Finished"}
        </p>
      </div>
      <pre className="max-h-96 overflow-auto rounded-lg border border-border/70 bg-black px-4 py-3 font-mono text-xs leading-5 text-white whitespace-pre-wrap">
        {content || "No logs yet."}
      </pre>
    </div>
  );
}
