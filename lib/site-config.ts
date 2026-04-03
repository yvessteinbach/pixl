import type { DeployMode, ServiceType } from "@prisma/client";

export const SERVICE_OPTIONS = [
  {
    value: "WEB_SERVICE" as ServiceType,
    label: "Web service",
    description: "Deploy APIs, websites, and long-running app containers.",
    available: true,
  },
  {
    value: "DATABASE" as ServiceType,
    label: "Database",
    description: "Managed databases are coming soon.",
    available: false,
  },
  {
    value: "CUSTOM" as ServiceType,
    label: "Custom",
    description: "Bring your own build and start commands.",
    available: true,
  },
] as const;

export const DEPLOY_MODE_OPTIONS = [
  {
    value: "AUTO" as DeployMode,
    label: "On Commit",
    description: "Deploy automatically when a new push hits the configured branch.",
  },
  {
    value: "MANUAL" as DeployMode,
    label: "Manual",
    description: "Queue new commits for review and deploy them when you choose.",
  },
] as const;

export function sanitizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export function sanitizeCommand(command?: string | null) {
  const trimmed = command?.trim();
  return trimmed ? trimmed : null;
}

export function sanitizeBranch(branch?: string | null) {
  return branch?.trim() || "main";
}

export function isSupportedServiceType(value?: string | null): value is ServiceType {
  return value === "WEB_SERVICE" || value === "DATABASE" || value === "CUSTOM";
}

export function isSupportedDeployMode(value?: string | null): value is DeployMode {
  return value === "AUTO" || value === "MANUAL";
}

export function isDeployableServiceType(value: ServiceType) {
  return value !== "DATABASE";
}
