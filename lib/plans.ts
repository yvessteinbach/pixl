import type { PlanTier } from "@prisma/client";

export type PlanConfig = {
  id: PlanTier;
  name: string;
  description: string;
  tagline: string;
  priceLabel: string;
  maxProjects: number;
  maxProjectStorageBytes: number;
  features: string[];
};

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: {
    id: "FREE",
    name: "Free",
    description: "A starter workspace for small personal projects and early testing.",
    tagline: "Start deploying with the core Pixl workflow.",
    priceLabel: "CHF 0",
    maxProjects: 3,
    maxProjectStorageBytes: 3 * 1024 * 1024 * 1024,
    features: [
      "GitHub import and one-click deploys",
      "Automatic redeploys from repository pushes",
      "Deployment history and project usage tracking",
      "Basic workspace management",
    ],
  },
  BASIC: {
    id: "BASIC",
    name: "Basic",
    description: "A paid workspace for growing teams that need more room and smoother daily usage.",
    tagline: "More projects and storage for production-ready teams.",
    priceLabel: "CHF 25",
    maxProjects: 15,
    maxProjectStorageBytes: 25 * 1024 * 1024 * 1024,
    features: [
      "Everything in Free",
      "More project and storage capacity",
      "Priority plan for future custom domains",
      "Ready for shared team workflows later on",
    ],
  },
  PRO: {
    id: "PRO",
    name: "Pro",
    description: "A high-capacity workspace for agencies, platforms, and customer-facing deployments.",
    tagline: "Built for heavier workloads and advanced hosting setups.",
    priceLabel: "CHF 125",
    maxProjects: 50,
    maxProjectStorageBytes: 100 * 1024 * 1024 * 1024,
    features: [
      "Everything in Basic",
      "Highest project and storage allowances",
      "Best fit for future advanced security controls",
      "Designed for custom domains and larger customer fleets",
    ],
  },
};

export const FREE_PLAN = PLANS.FREE;

export function getPlanConfig(plan: PlanTier | null | undefined): PlanConfig {
  if (!plan) return FREE_PLAN;
  return PLANS[plan] ?? FREE_PLAN;
}
