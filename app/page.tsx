import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import RepoPicker from "@/components/RepoPicker";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2, Lock, Rocket } from "lucide-react";

export default async function Page() {
  const session = await auth();
  if (!session?.user?.id) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1.35fr_24rem]">
        <Card className="border-border/70">
          <CardContent className="flex min-h-[540px] flex-col justify-between p-10 md:p-12">
            <div className="space-y-6">
              <Badge variant="outline" className="w-fit rounded-full px-3 py-1 text-[10px] uppercase tracking-[0.22em]">
                Swiss-first application hosting
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl">
                  Minimal deployments,
                  <span className="block text-primary"> secure infrastructure.</span>
                </h1>
                <p className="max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                  Launch GitHub repositories to your own infrastructure with a calmer control plane, signed webhook automation, and a product surface designed to stay simple as Pixl grows.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <form action={async () => {
                  "use server"
                  await signIn("github")
                }}>
                  <Button type="submit" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    Create account
                    <ArrowRight className="size-4" />
                  </Button>
                </form>
                <form action={async () => {
                  "use server"
                  await signIn("github")
                }}>
                  <Button type="submit" variant="outline" size="lg">
                    Log in
                  </Button>
                </form>
              </div>
            </div>

            <div className="grid gap-3 pt-10 md:grid-cols-3">
              {[
                { icon: Rocket, title: "Deploy faster", text: "Import repositories and ship updates with webhook-driven rebuilds." },
                { icon: Lock, title: "Own your infra", text: "Keep the control plane public while runners stay private and regional." },
                { icon: CheckCircle2, title: "Stay focused", text: "Use simple blocks and predictable UI patterns instead of brittle custom styling." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="rounded-2xl border bg-muted/30 p-4">
                  <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-4" />
                  </div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70">
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border bg-muted/30 p-4">
              <p className="text-sm font-medium">Sign up with GitHub</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Create your Pixl workspace, import repositories, and configure secure deployments.
              </p>
              <form
                className="mt-4"
                action={async () => {
                  "use server"
                  await signIn("github")
                }}
              >
                <Button type="submit" className="w-full bg-primary text-primary-foreground hover:bg-primary/90">
                  Continue with GitHub
                </Button>
              </form>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <p className="text-sm font-medium">Product direction</p>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                <li>Stable project domains and clean deployment history</li>
                <li>Regional hosting with Swiss security positioning</li>
                <li>Tailwind + shadcn component system for future product work</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const account = await prisma.account.findFirst({
    where: { userId: session.user.id, provider: "github" },
  });

  let repos = [];
  if (account?.access_token) {
    const res = await fetch("https://api.github.com/user/repos?sort=updated&per_page=12", {
      headers: {
        Authorization: `Bearer ${account.access_token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    if (res.ok) {
      repos = await res.json();
    }
  }

  const deployedSites = await prisma.site.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="flex flex-col gap-6">
      {deployedSites.length > 0 && (
        <section className="flex flex-col gap-4">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight">Projects</h1>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {deployedSites.map((site) => (
              <Link href={`/project/${site.id}`} key={site.id}>
                <Card className="h-full border-border/70 transition-colors hover:border-primary/30">
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between gap-3">
                      <CardTitle className="text-base">{site.name}</CardTitle>
                      <Badge variant={site.status === "READY" ? "success" : site.status === "FAILED" ? "destructive" : "warning"}>
                        {site.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm text-muted-foreground">
                    <p className="font-mono text-foreground">{site.subdomain}.localhost</p>
                    <p>{new Date(site.createdAt).toLocaleDateString()} via GitHub</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Deploy a new project</h2>
          <p className="text-sm text-muted-foreground">Choose a GitHub repository and ship it into Pixl.</p>
        </div>
        <RepoPicker repos={repos} userId={session.user.id} />
      </section>
    </div>
  )
}
