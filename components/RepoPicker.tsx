"use client";

import { useMemo, useState } from "react";
import { FolderGit2, Rocket, ExternalLink, Server, Wrench, Database, GitBranch, Settings2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Repo = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  private: boolean;
  default_branch?: string;
};

const serviceOptions = [
  {
    value: "WEB_SERVICE",
    label: "Web service",
    description: "Deploy websites, APIs, and long-running containers.",
    icon: Server,
    available: true,
  },
  {
    value: "DATABASE",
    label: "Database",
    description: "Managed databases are coming soon.",
    icon: Database,
    available: false,
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "Use your own build and start commands.",
    icon: Wrench,
    available: true,
  },
] as const;

const deployModeOptions = [
  {
    value: "AUTO",
    label: "On Commit",
    description: "Deploy automatically whenever a new push lands on the configured branch.",
  },
  {
    value: "MANUAL",
    label: "Manual",
    description: "Queue new commits and deploy them only when you confirm.",
  },
] as const;

export default function RepoPicker({ repos, userId }: { repos: Repo[]; userId: string }) {
  const [deploying, setDeploying] = useState<number | null>(null);
  const [openRepoId, setOpenRepoId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "",
    branch: "main",
    serviceType: "WEB_SERVICE" as "WEB_SERVICE" | "CUSTOM" | "DATABASE",
    deployMode: "AUTO" as "AUTO" | "MANUAL",
    installCommand: "",
    buildCommand: "",
    startCommand: "",
  });
  const router = useRouter();
  void userId;

  const openRepo = useMemo(
    () => repos.find((repo) => repo.id === openRepoId) ?? null,
    [openRepoId, repos]
  );

  const openDialogForRepo = (repo: Repo) => {
    setForm({
      name: repo.name,
      branch: repo.default_branch || "main",
      serviceType: "WEB_SERVICE",
      deployMode: "AUTO",
      installCommand: "",
      buildCommand: "",
      startCommand: "",
    });
    setOpenRepoId(repo.id);
  };

  const handleServiceTypeChange = (serviceType: "WEB_SERVICE" | "CUSTOM") => {
    setForm((current) => ({
      ...current,
      serviceType,
    }));
  };

  const handleDeploy = async () => {
    if (!openRepo) return;

    setDeploying(openRepo.id);
    try {
      const res = await fetch("/api/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repoUrl: openRepo.html_url,
          providerId: openRepo.id.toString(),
          name: form.name,
          branch: form.branch,
          serviceType: form.serviceType,
          deployMode: form.deployMode,
          installCommand: form.installCommand || undefined,
          buildCommand: form.buildCommand || undefined,
          startCommand: form.startCommand || undefined,
        }),
      });

      if (res.ok) {
        const body = await res.json();
        setOpenRepoId(null);
        router.push(`/project/${body.site.id}`);
      } else {
        const body = await res.json().catch(() => null);
        alert(body?.error || "Deploy failed");
      }
    } catch {
      alert("Error deploying");
    } finally {
      setDeploying(null);
    }
  };

  if (!repos || !repos.length) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-12 text-center text-muted-foreground">
        <FolderGit2 className="size-12" />
        <p>No repositories found or missing GitHub permissions.</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {repos.map((repo) => (
          <Card key={repo.id} className="border-border/70 bg-card/80">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderGit2 className="size-4 text-muted-foreground" />
                  {repo.name}
                </CardTitle>
                {repo.private ? <Badge variant="outline">Private</Badge> : null}
              </div>
            </CardHeader>
            <CardContent className="min-h-24 space-y-3 text-sm text-muted-foreground">
              <p>{repo.description || "No description provided."}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <GitBranch className="size-3.5" />
                Default branch: {repo.default_branch || "main"}
              </div>
            </CardContent>
            <CardFooter className="flex items-center justify-between gap-2 border-t pt-4">
              <Button asChild variant="outline" size="sm">
                <a href={repo.html_url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" /> View
                </a>
              </Button>
              <Button
                onClick={() => openDialogForRepo(repo)}
                size="sm"
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                <Settings2 className="size-4" /> Configure
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={openRepoId !== null} onOpenChange={(open) => !open && setOpenRepoId(null)}>
        <DialogTrigger asChild>
          <span className="hidden" />
        </DialogTrigger>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Configure project</DialogTitle>
            <DialogDescription>
              Choose the service type, deployment commands, and whether pushes should deploy automatically or wait for manual approval.
            </DialogDescription>
          </DialogHeader>

          {openRepo ? (
            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <div className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    1. Select a service
                  </p>
                  <div className="space-y-2">
                    {serviceOptions.map(({ value, label, description, icon: Icon, available }) => {
                      const isActive = form.serviceType === value;
                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() => available && handleServiceTypeChange(value as "WEB_SERVICE" | "CUSTOM")}
                          disabled={!available}
                          className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                            isActive
                              ? "border-primary/30 bg-primary/10"
                              : "border-border/70 bg-muted/20 hover:border-primary/20"
                          } ${!available ? "cursor-not-allowed opacity-50" : ""}`}
                        >
                          <div className="mt-0.5 flex size-10 items-center justify-center rounded-xl bg-background/70 text-primary">
                            <Icon className="size-4" />
                          </div>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{label}</p>
                              {!available ? <Badge variant="outline">Soon</Badge> : null}
                            </div>
                            <p className="text-sm text-muted-foreground">{description}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-2xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    2. Deploy mode
                  </p>
                  <div className="mt-3 grid gap-2">
                    {deployModeOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() =>
                          setForm((current) => ({ ...current, deployMode: option.value }))
                        }
                        className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                          form.deployMode === option.value
                            ? "border-primary/30 bg-primary/10"
                            : "border-border/70 hover:border-primary/20"
                        }`}
                      >
                        <p className="font-medium text-foreground">{option.label}</p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {option.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  3. Deploy your code
                </p>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Project name</span>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, name: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Branch</span>
                  <Input
                    value={form.branch}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, branch: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Install command</span>
                  <Input
                    placeholder="Auto-detect"
                    value={form.installCommand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, installCommand: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Build command</span>
                  <Input
                    placeholder="Auto-detect"
                    value={form.buildCommand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, buildCommand: event.target.value }))
                    }
                  />
                </label>

                <label className="grid gap-2">
                  <span className="text-sm font-medium">Start command</span>
                  <Input
                    placeholder="Auto-detect"
                    value={form.startCommand}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, startCommand: event.target.value }))
                    }
                  />
                </label>

                <div className="rounded-xl border border-border/70 bg-background/80 px-4 py-3 text-sm text-muted-foreground">
                  {form.deployMode === "AUTO"
                    ? "New commits will redeploy automatically on the configured branch."
                    : "New commits will be queued on the project page until you trigger the deploy manually."}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setOpenRepoId(null)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleDeploy}
                    disabled={deploying === openRepo.id || form.serviceType === "DATABASE" || !form.name.trim()}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Rocket className="size-4" />
                    {deploying === openRepo.id ? "Deploying..." : "Create project"}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
