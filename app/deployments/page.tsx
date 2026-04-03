import { auth } from "@/auth";
import { formatDeploymentSource, formatDeploymentStatus } from "@/lib/deployments";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import Link from "next/link";
import { GitBranch, Clock, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DeploymentsPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/");

  const deployments = await prisma.deployment.findMany({
    where: { site: { userId: session.user.id } },
    include: { site: true },
    orderBy: { createdAt: "desc" },
  });

  const statusIcon = (status: string) => {
    if (status === "READY") return <CheckCircle2 size={16} style={{ color: "#10b981" }} />;
    if (status === "FAILED") return <XCircle size={16} style={{ color: "#ef4444" }} />;
    return <Loader2 size={16} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />;
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Deployments</h1>
        <p className="mt-1 text-sm text-muted-foreground">A minimal feed of production changes across your projects.</p>
      </div>

      {deployments.length === 0 ? (
        <Card className="border-border/70">
          <CardContent className="flex items-center justify-center p-16 text-center text-muted-foreground">
            <p>No deployments yet. Go to <Link href="/" className="ml-1 text-foreground underline">Projects</Link> to deploy your first app.</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Deployment feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="hidden grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr] gap-4 px-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground md:grid">
              <span>Project</span>
              <span>Status</span>
              <span>Source</span>
              <span>URL</span>
              <span>Date</span>
            </div>
            {deployments.map((deployment) => (
              <Link
                href={`/project/${deployment.siteId}`}
                key={deployment.id}
                className="grid gap-3 rounded-none border border-border px-4 py-4 transition-colors hover:bg-accent md:grid-cols-[1.5fr_1fr_1fr_1.2fr_1fr] md:items-center"
              >
                <span className="font-medium text-foreground">{deployment.site.name}</span>
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  {statusIcon(deployment.status)}
                  {formatDeploymentStatus(deployment.status)}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <GitBranch className="size-3.5" /> {formatDeploymentSource(deployment.source)}
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {deployment.dockerPort ? `localhost:${deployment.dockerPort}` : "—"}
                </span>
                <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                  <Clock className="size-3.5" />
                  {new Date(deployment.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
