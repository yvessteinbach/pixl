export const DEPLOYMENT_STATUS = {
  BUILDING: "BUILDING",
  READY: "READY",
  FAILED: "FAILED",
} as const;

export const DEPLOYMENT_SOURCE = {
  GITHUB_IMPORT: "github_import",
  WEBHOOK_PUSH: "webhook_push",
} as const;

export function formatDeploymentStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function formatDeploymentSource(source: string) {
  if (source === DEPLOYMENT_SOURCE.GITHUB_IMPORT) {
    return "Initial Import";
  }

  if (source === DEPLOYMENT_SOURCE.WEBHOOK_PUSH) {
    return "Webhook Push";
  }

  return source.replace(/_/g, " ");
}

export function createDockerPort() {
  return Math.floor(Math.random() * 10000) + 10000;
}

export function createContainerName(deploymentId: string) {
  return `pixl-${deploymentId}`;
}
