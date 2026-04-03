import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getPlanConfig, PLANS } from "@/lib/plans";
import { formatBytes } from "@/lib/usage";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Sparkles } from "lucide-react";

export default async function PlansPage() {
  const session = await auth();
  if (!session?.user?.id) return redirect("/");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { plan: true },
  });

  const currentPlan = getPlanConfig(user?.plan);
  const plans = Object.values(PLANS);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Plans</h1>
        <p className="mt-1 text-sm text-muted-foreground">Choose the workspace tier that matches your deployment footprint.
          Billing is not wired yet, but your active plan can already be changed
          directly in the database.</p>
      </div>

      <Card className="overflow-hidden border-border/70 bg-[linear-gradient(135deg,rgba(59,130,246,0.12),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.04),transparent)] dark:bg-[linear-gradient(135deg,rgba(59,130,246,0.16),transparent_45%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
        <CardContent className="flex flex-col gap-5 p-6 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                Current subscription
              </Badge>
            </div>
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">
                {currentPlan.name} plan
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentPlan.description}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlan.id;

          return (
            <Card
              key={plan.id}
              className={`flex h-full flex-col border-border/70 ${isCurrent ? "border-primary/35 shadow-[0_0_0_1px_rgba(59,130,246,0.18)]" : ""
                }`}
            >
              <CardHeader className="gap-4 border-b pb-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-xl">{plan.name}</CardTitle>
                    <CardDescription className="mt-2">
                      {plan.description}
                    </CardDescription>
                  </div>
                  {isCurrent ? (
                    <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                      Current
                    </Badge>
                  ) : null}
                </div>

                <div className="flex items-end gap-2">
                  <span className="text-4xl font-semibold tracking-tight">
                    {plan.priceLabel}
                  </span>
                  <span className="pb-1 text-sm text-muted-foreground">
                    / month
                  </span>
                </div>

                <p className="text-sm text-muted-foreground">{plan.tagline}</p>
              </CardHeader>

              <CardContent className="flex flex-1 flex-col gap-6 p-6">
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="rounded-2xl border bg-muted/25 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Projects
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {plan.maxProjects}
                    </p>
                  </div>
                  <div className="rounded-2xl border bg-muted/25 px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                      Storage
                    </p>
                    <p className="mt-2 text-2xl font-semibold">
                      {formatBytes(plan.maxProjectStorageBytes)}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Included features</p>
                  <div className="space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 text-sm">
                        <div className="mt-0.5 flex size-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                          <Check className="size-3.5" />
                        </div>
                        <span className="text-muted-foreground">{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-auto pt-2">
                  <Button
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90"
                    disabled
                  >
                    {isCurrent ? "Current plan" : "Upgrade coming soon"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="border-border/70">
        <CardContent className="flex flex-col gap-4 p-6 md:flex-row md:items-start md:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="size-4" />
              <p className="text-sm font-medium">Testing plans right now</p>
            </div>
            <p className="max-w-3xl text-sm text-muted-foreground">
              Until billing is connected, you can switch a user manually in
              Prisma Studio by editing the <span className="font-mono">plan</span>{" "}
              field on the <span className="font-mono">User</span> record to{" "}
              <span className="font-mono">FREE</span>,{" "}
              <span className="font-mono">BASIC</span>, or{" "}
              <span className="font-mono">PRO</span>.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
