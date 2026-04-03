import { auth } from "@/auth";
import { getDeploymentLogPath, readDeploymentLog } from "@/lib/deployment-logs";
import { formatDeploymentSource, formatDeploymentStatus } from "@/lib/deployments";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Image from "next/image";
import { Link as LinkIcon, RefreshCw, Activity, BarChart, Settings, GitBranch, GitCommit, CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import DeleteSiteButton from "@/components/DeleteSiteButton";
import SiteStatus from "./SiteStatus";
import EditProjectNameButton from "./EditProjectNameButton";
import DeploymentLogPanel from "./DeploymentLogPanel";
import PendingDeployActions from "./PendingDeployActions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return redirect("/");
  }

  const { id } = await params;

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      deployments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!site || site.userId !== session.user.id) {
    return notFound();
  }

  const latestDeployment = site.deployments.find((deployment) => deployment.isCurrent) ?? site.deployments[0] ?? null;
  const livePort = latestDeployment?.dockerPort ?? site.dockerPort ?? 3000;
  const siteUrl = `http://localhost:${livePort}`;
  const displayUrl = `localhost:${livePort}`;
  const currentStatus = latestDeployment?.status ?? site.status;
  const hasPendingDeploy = Boolean(site.pendingCommitSha);
  const pendingCommitUrl = site.pendingCommitSha
    ? `${site.repoUrl.replace(/\/$/, "")}/commit/${site.pendingCommitSha}`
    : null;
  const pendingCommitTimestamp = site.pendingCommitAt
    ? new Date(site.pendingCommitAt).toLocaleString()
    : null;
  const latestDeploymentLog = latestDeployment
    ? await readDeploymentLog(getDeploymentLogPath(site.userId, site.id, latestDeployment.id))
    : "";

  const statusIcon = (status: string) => {
    if (status === "READY") return <CheckCircle2 size={16} style={{ color: "#10b981" }} />;
    if (status === "FAILED") return <XCircle size={16} style={{ color: "#ef4444" }} />;
    return <Loader2 size={16} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />;
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-3xl font-semibold tracking-tight">Production Deployment</h2>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <a href={site.repoUrl} target="_blank" rel="noreferrer">
              <LinkIcon className="size-4" /> Repository
            </a>
          </Button>
          {currentStatus === "READY" && (
            <Button variant="default" asChild size="sm">
              <a href={siteUrl} target="_blank" rel="noreferrer">
                Visit
              </a>
            </Button>
          )}
        </div>
      </div>

      {hasPendingDeploy ? (
        <Card className="border-primary/25 bg-primary/8">
          <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Hey, a new commit happened. Do you want to deploy it?</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Commit {site.pendingCommitSha?.slice(0, 7)} on branch {site.pendingCommitBranch || site.branch} is waiting for your review.
                {pendingCommitTimestamp ? ` Received ${pendingCommitTimestamp}.` : ""}
              </p>
            </div>
            <PendingDeployActions siteId={site.id} commitUrl={pendingCommitUrl} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="overflow-hidden border-border/70">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b pb-4">
          <CardTitle className="text-sm font-semibold">{site.name}</CardTitle>
          <EditProjectNameButton siteId={site.id} initialName={site.name} />
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid md:grid-cols-[minmax(320px,1fr)_440px]">
            <div className="border-b border-border p-4 md:border-b-0 md:border-r">
              <div className="overflow-hidden rounded-lg border bg-muted/30">
                <Image
                  src="/mock-app.png"
                  alt="Site Preview"
                  width={600}
                  height={400}
                  className="aspect-[1.45/1] h-auto w-full object-cover"
                />
              </div>
            </div>
            <div className="flex h-full flex-col gap-5 p-4">
              <div className="space-y-4">
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deployment</p>
                  <a href={siteUrl} target="_blank" rel="noreferrer" className="font-mono text-sm text-foreground hover:underline">{displayUrl}</a>
                </div>
                <div>
                  <p className="mb-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Domains</p>
                  <a href={siteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-sm text-foreground hover:underline">{displayUrl} <ExternalLinkIcon /></a>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Status</p>
                  <SiteStatus siteId={site.id} initialStatus={currentStatus} />
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Created</p>
                  <p className="font-mono text-sm text-foreground">{new Date(site.createdAt).toLocaleDateString()}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Source</p>
                <div className="inline-flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 font-mono text-xs">
                  <GitBranch className="size-3.5" /> <span>{latestDeployment?.branch || "main"}</span>
                  <GitCommit className="ml-2 size-3.5" /> <span>{latestDeployment?.commitSha?.slice(0, 7) || "initial"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Service</p>
                  <p className="text-sm text-foreground">
                    {site.serviceType === "WEB_SERVICE"
                      ? "Web service"
                      : site.serviceType === "CUSTOM"
                        ? "Custom"
                        : "Database"}
                  </p>
                </div>
                <div>
                  <p className="mb-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deploy mode</p>
                  <p className="text-sm text-foreground">
                    {site.deployMode === "AUTO" ? "On Commit" : "Manual"}
                  </p>
                </div>
              </div>

              <div className="space-y-2 rounded-lg border border-border/70 bg-muted/20 p-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Deploy settings</p>
                <div className="grid gap-2 text-sm md:grid-cols-3">
                  <div>
                    <p className="text-muted-foreground">Branch</p>
                    <p className="font-mono text-foreground">{site.branch}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Build</p>
                    <p className="font-mono text-foreground">{site.buildCommand || "Auto-detect"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Start</p>
                    <p className="font-mono text-foreground">{site.startCommand || "Auto-detect"}</p>
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-2">
                <DeleteSiteButton siteId={site.id} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Production Checklist</CardTitle>
            <span className="text-xs text-muted-foreground">1/5</span>
          </CardHeader>
          <CardContent className="space-y-2">
            <ChecklistItem active icon={LinkIcon}>Connect Git Repository</ChecklistItem>
            <ChecklistItem icon={Activity}>Add Custom Domain</ChecklistItem>
            <ChecklistItem icon={RefreshCw}>Preview Deployment</ChecklistItem>
            <ChecklistItem icon={BarChart}>Enable Web Analytics</ChecklistItem>
            <ChecklistItem icon={Settings}>Enable Speed Insights</ChecklistItem>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-semibold">Observability</CardTitle>
            <span className="text-xs text-muted-foreground">6h</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Edge Requests</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">11</p>
            </div>
            <svg width="100%" height="42">
              <polyline points="0,35 150,35 160,5 170,35 250,35 260,15 270,35 300,35" fill="none" stroke="currentColor" strokeWidth="2" className="text-blue-500" />
            </svg>
            <div>
              <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Error Rate</p>
              <p className="mt-1 text-2xl font-semibold tracking-tight">0%</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Analytics</CardTitle>
          </CardHeader>
          <CardContent className="flex min-h-52 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
            <BarChart className="size-6" />
            <p className="text-sm">Track visitors and page views</p>
            <Button variant="ghost" size="sm">Enable</Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base">Deployment History</CardTitle>
        </CardHeader>
        <CardContent>
          {site.deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No deployment history exists yet for this project.
            </p>
          ) : (
            <div className="space-y-2">
              {site.deployments.map((deployment) => (
                <div key={deployment.id} className="grid gap-3 rounded-lg border border-border/60 px-4 py-4 md:grid-cols-[1.35fr_1fr_1.2fr_1fr] md:items-center">
                  <div className="flex items-center gap-3 font-medium text-foreground">
                    {statusIcon(deployment.status)}
                    <span>{formatDeploymentStatus(deployment.status)}</span>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{formatDeploymentSource(deployment.source)}</span>
                  <span className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                    <Clock className="size-3.5" />
                    {new Date(deployment.createdAt).toLocaleString()}
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {deployment.dockerPort ? `localhost:${deployment.dockerPort}` : "—"}
                    {deployment.isCurrent ? " • Live" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {latestDeployment ? (
        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Build Output</CardTitle>
          </CardHeader>
          <CardContent>
            <DeploymentLogPanel
              deploymentId={latestDeployment.id}
              initialContent={latestDeploymentLog}
              initialStatus={latestDeployment.status}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function ChecklistItem({
  children,
  icon: Icon,
  active = false,
}: {
  children: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 text-sm ${active ? "border-blue-500/30 bg-blue-500/10 text-foreground" : "border-border/60 text-muted-foreground"}`}>
      <Icon className="size-4" />
      <span>{children}</span>
      {active ? <CheckCircle2 className="ml-auto size-4 text-emerald-500" /> : null}
    </div>
  );
}

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line>
  </svg>
)
