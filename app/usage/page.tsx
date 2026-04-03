import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import {
  Activity,
  ArrowUpRight,
  Database,
  GitBranch,
  HardDrive,
  Rocket,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlanConfig } from "@/lib/plans";
import {
  formatBytes,
  getCustomersDiskUsageBytes,
  getProjectDiskUsageBytes,
} from "@/lib/usage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default async function UsagePage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/");
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });
  const plan = getPlanConfig(user?.plan);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const sites = await prisma.site.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
  });

  const [diskUsageBytes, totalDeployments, deploymentsThisMonth] =
    await Promise.all([
      getCustomersDiskUsageBytes(userId),
      prisma.deployment.count({
        where: { site: { userId: session.user.id } },
      }),
      prisma.deployment.count({
        where: {
          site: { userId: session.user.id },
          createdAt: { gte: startOfMonth },
        },
      }),
    ]);

  const storageLimit = plan.maxProjectStorageBytes;
  const storageUsagePercent = Math.min(
    (diskUsageBytes / storageLimit) * 100,
    100
  );
  const storageUsageDisplayPercent =
    diskUsageBytes > 0 && storageUsagePercent < 1
      ? 1
      : Math.round(storageUsagePercent);
  const gaugePercent = Math.max(
    storageUsagePercent,
    diskUsageBytes > 0 ? 1 : 0
  );

  const diskUsage = formatBytes(diskUsageBytes);
  const storageLimitLabel = formatBytes(storageLimit);
  const readySites = sites.filter((site) => site.status === "READY").length;
  const projectsRemaining = Math.max(plan.maxProjects - sites.length, 0);
  const storageRemaining = Math.max(storageLimit - diskUsageBytes, 0);

  const primaryStats = [
    {
      icon: GitBranch,
      label: "Projects",
      value: `${sites.length}/${plan.maxProjects}`,
      detail: `${projectsRemaining} remaining`,
      tone: "bg-primary/12 text-primary border-primary/20",
    },
    {
      icon: HardDrive,
      label: "Storage",
      value: diskUsage,
      detail: `${formatBytes(storageRemaining)} left`,
      tone: "bg-blue-500/12 text-blue-500 border-blue-500/20 dark:text-blue-400",
    },
    {
      icon: Activity,
      label: "Running",
      value: String(readySites),
      detail: `${Math.max(sites.length - readySites, 0)} inactive`,
      tone: "bg-emerald-500/12 text-emerald-600 border-emerald-500/20 dark:text-emerald-400",
    },
    {
      icon: Rocket,
      label: "Deployments",
      value: String(totalDeployments),
      detail: `${deploymentsThisMonth} this month`,
      tone: "bg-slate-500/12 text-slate-600 border-slate-500/20 dark:text-slate-300",
    },
  ];

  const projectsWithUsage = await Promise.all(
    sites.map(async (site) => ({
      ...site,
      diskUsageBytes: await getProjectDiskUsageBytes(userId, site.id),
    }))
  );

  const sortedProjects = [...projectsWithUsage].sort(
    (a, b) => b.diskUsageBytes - a.diskUsageBytes
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Usage</h1>
        <p className="mt-1 text-sm text-muted-foreground">Track your current workspace footprint and see how close you are
          to your current plan limits.</p>
      </div>

      <Card className="overflow-hidden border-border/70 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] dark:bg-[linear-gradient(135deg,rgba(59,130,246,0.16),transparent_40%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
        <CardContent className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Current subscription
              </Badge>
              <span className="text-sm text-muted-foreground">
                {plan.maxProjects} projects included
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {plan.name} plan
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                Scale beyond the starter limits when you are ready for more
                projects, more storage, and future add-ons like domains and
                advanced analytics.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="rounded-none bg-primary px-5 text-primary-foreground hover:bg-primary/90">
              Upgrade plan
              <ArrowUpRight className="size-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6">
        <Card className="overflow-hidden border-border/70 bg-card text-foreground dark:border-white/10 dark:bg-card dark:text-white">
          <CardHeader className="border-b border-border/70 pb-5 dark:border-white/10">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full border border-primary/25 bg-primary/15 text-primary">
                <Database className="size-5" />
              </div>
              <div>
                <CardTitle className="text-2xl font-medium tracking-tight text-foreground dark:text-white">
                  Workspace
                </CardTitle>
                <CardDescription className="text-muted-foreground dark:text-slate-300">
                  Real usage based on projects, cloned repository storage, and
                  deployment activity.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="grid gap-8 p-8 lg:grid-cols-[420px_minmax(0,1fr)] lg:items-center lg:gap-14">
            <div className="flex justify-center">
              <div className="relative flex aspect-square w-full max-w-[420px] items-center justify-center rounded-full border border-border/60 bg-black/[0.03] dark:border-white/10 dark:bg-black/10">
                <div
                  className="absolute inset-6 rounded-full"
                  style={{
                    background: `conic-gradient(rgb(59, 130, 246) 0deg ${gaugePercent * 3.6}deg, rgba(148, 163, 184, 0.18) ${gaugePercent * 3.6}deg 360deg)`,
                  }}
                />
                <div className="absolute inset-12 rounded-full border border-border/60 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(241,245,249,0.98))] dark:border-white/8 dark:bg-[linear-gradient(180deg,rgba(2,6,23,0.96),rgba(15,23,42,0.98))]" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-lg text-muted-foreground dark:text-slate-400">Workspace capacity</p>
                  <p className="mt-3 text-6xl font-semibold tracking-tight text-foreground dark:text-white">
                    {storageUsageDisplayPercent}%
                  </p>
                  <p className="mt-3 text-base text-muted-foreground dark:text-slate-300">
                    {diskUsage} used of {storageLimitLabel}
                  </p>
                  <p className="mt-2 text-sm text-emerald-400">
                    {projectsRemaining} project slot
                    {projectsRemaining === 1 ? "" : "s"} left
                  </p>
                </div>
              </div>
            </div>

            <div className="w-full space-y-3 lg:justify-self-end lg:max-w-lg">
              {primaryStats.map(({ icon: Icon, label, value, detail, tone }) => (
                <div
                  key={label}
                  className="flex items-center justify-between gap-6 rounded-full border border-border/60 bg-background/50 px-4 py-4 dark:border-white/10 dark:bg-white/5"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`flex size-11 items-center justify-center rounded-full border ${tone}`}
                    >
                      <Icon className="size-5" />
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground dark:text-slate-300">{label}</p>
                      <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground dark:text-white">
                        {value}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground dark:text-slate-400">{detail}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-base">Per-project breakdown</CardTitle>
          <CardDescription>
            Individual storage footprints across all deployed projects.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {sites.length === 0 ? (
            <div className="p-6">
              <p className="text-sm text-muted-foreground">No projects yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {sortedProjects.map((site) => (
                <div
                  key={site.id}
                  className="grid gap-4 px-6 py-5 md:grid-cols-[minmax(0,1.8fr)_140px_120px_120px] md:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-3">
                      <span
                        className="size-2 rounded-full"
                        style={{
                          background:
                            site.status === "READY"
                              ? "#10b981"
                              : site.status === "FAILED"
                                ? "#ef4444"
                                : "#3b82f6",
                        }}
                      />
                      <p className="truncate font-medium">{site.name}</p>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {site.status === "READY"
                        ? "Live project"
                        : site.status === "FAILED"
                          ? "Needs attention"
                          : "Deployment in progress"}
                    </p>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {formatBytes(site.diskUsageBytes)}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {site.dockerPort ? `Port ${site.dockerPort}` : "—"}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {new Date(site.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
