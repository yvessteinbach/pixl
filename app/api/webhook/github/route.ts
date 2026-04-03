import {
  createContainerName,
  createDockerPort,
  DEPLOYMENT_SOURCE,
  DEPLOYMENT_STATUS,
} from "@/lib/deployments";
import { createInstallCommand, resolveDeployConfig } from "@/lib/build-runner";
import { appendDeploymentLog, getDeploymentLogPath, runLoggedCommand } from "@/lib/deployment-logs";
import { getWebhookSecret } from "@/lib/env";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

type GitHubPushPayload = {
  ref?: string;
  after?: string;
  repository?: {
    html_url?: string;
    default_branch?: string;
  };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: Request) {
  try {
    // Verify GitHub signature if secret is configured
    const webhookSecret = getWebhookSecret();
    if (webhookSecret) {
      const signature = req.headers.get("x-hub-signature-256");
      const body = await req.text();
      if (signature) {
        const expected = "sha256=" + crypto
          .createHmac("sha256", webhookSecret)
          .update(body)
          .digest("hex");
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
        }
      }
      const payload = JSON.parse(body) as GitHubPushPayload;
      return handlePush(payload);
    }

    const payload = await req.json() as GitHubPushPayload;
    return handlePush(payload);
  } catch (err: unknown) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

async function handlePush(payload: GitHubPushPayload) {
  // Only act on push events to the default branch
  const event = payload.ref; // e.g. "refs/heads/main"
  const repoUrl = payload.repository?.html_url;
  const branch = payload.repository?.default_branch || "main";
  const pushedBranch = event?.split("/").pop() || branch;
  const commitSha = payload.after;

  if (!repoUrl) {
    return NextResponse.json({ error: "Missing repository info" }, { status: 400 });
  }

  const sites = await prisma.site.findMany({ where: { repoUrl } });
  
  if (sites.length === 0) {
    return NextResponse.json({ message: "No tracked sites for this repo" });
  }

  let processedSites = 0;

  // Trigger redeploy for each tracked site
  for (const site of sites) {
    if (pushedBranch !== site.branch) {
      continue;
    }

    processedSites += 1;

    if (site.deployMode === "MANUAL") {
      await prisma.site.update({
        where: { id: site.id },
        data: {
          pendingCommitSha: commitSha,
          pendingCommitBranch: pushedBranch,
          pendingCommitAt: new Date(),
        },
      });
      continue;
    }

    const dockerPort = site.dockerPort ?? createDockerPort();
    const deployment = await prisma.deployment.create({
      data: {
        siteId: site.id,
        status: DEPLOYMENT_STATUS.BUILDING,
        source: DEPLOYMENT_SOURCE.WEBHOOK_PUSH,
        dockerPort,
        branch: pushedBranch,
        commitSha,
      },
    });

    (async () => {
      try {
        await prisma.site.update({ where: { id: site.id }, data: { status: DEPLOYMENT_STATUS.BUILDING } });

        const repoPath = path.join(process.cwd(), "customers", site.userId, site.id);
        const logPath = getDeploymentLogPath(site.userId, site.id, deployment.id);
        const imageName = createContainerName(deployment.id);
        await appendDeploymentLog(logPath, `Starting automatic deployment for commit ${commitSha ?? "unknown"}`);
        const previousCurrentDeployments = await prisma.deployment.findMany({
          where: {
            siteId: site.id,
            isCurrent: true,
            id: { not: deployment.id },
          },
        });

        // Check the repo directory is there
        try {
          await fs.access(repoPath);
        } catch {
          console.error(`Repo path not found for ${site.name}: ${repoPath}`);
          await prisma.$transaction([
            prisma.site.update({ where: { id: site.id }, data: { status: DEPLOYMENT_STATUS.FAILED } }),
            prisma.deployment.update({
              where: { id: deployment.id },
              data: { status: DEPLOYMENT_STATUS.FAILED },
            }),
          ]);
          return;
        }

        console.log(`[Webhook] Pulling latest changes for ${site.name}...`);
        await runLoggedCommand(`git checkout ${site.branch}`, repoPath, logPath).catch(() => {});
        await runLoggedCommand(`git pull`, repoPath, logPath);
        const resolvedConfig = await resolveDeployConfig(repoPath, {
          installCommand: site.installCommand ?? createInstallCommand(await fs.readdir(repoPath)),
          buildCommand: site.buildCommand,
          startCommand: site.startCommand,
        });

        if (resolvedConfig.generatedDockerfile) {
          await fs.writeFile(path.join(repoPath, "Dockerfile"), resolvedConfig.generatedDockerfile);
        }

        console.log(`[Webhook] Rebuilding ${imageName}...`);
        await runLoggedCommand(`docker build -t ${imageName} .`, repoPath, logPath);

        // This project keeps one stable external port, so the previous live
        // container must release that port before the replacement can start.
        for (const oldDeployment of previousCurrentDeployments) {
          if (!oldDeployment.containerName) {
            continue;
          }

          await runLoggedCommand(`docker stop ${oldDeployment.containerName}`, repoPath, logPath).catch(() => {});
          await runLoggedCommand(`docker rm ${oldDeployment.containerName}`, repoPath, logPath).catch(() => {});
        }

        console.log(`[Webhook] Starting new container on port ${deployment.dockerPort}...`);
        await runLoggedCommand(
          `docker run -d -p ${deployment.dockerPort}:${resolvedConfig.internalPort} --name ${imageName} ${imageName}`,
          repoPath,
          logPath
        );
        await appendDeploymentLog(logPath, `Deployment is live on localhost:${deployment.dockerPort}`);

        await prisma.$transaction([
          prisma.deployment.updateMany({
            where: {
              siteId: site.id,
              isCurrent: true,
              id: { not: deployment.id },
            },
            data: { isCurrent: false },
          }),
          prisma.site.update({
            where: { id: site.id },
            data: {
              status: DEPLOYMENT_STATUS.READY,
              pendingCommitAt: null,
              pendingCommitBranch: null,
              pendingCommitSha: null,
            },
          }),
          prisma.deployment.update({
            where: { id: deployment.id },
            data: {
              status: DEPLOYMENT_STATUS.READY,
              containerName: imageName,
              isCurrent: true,
            },
          }),
        ]);

        console.log(`[Webhook] Redeploy successful for ${site.name}!`);
      } catch (e) {
        console.error(`[Webhook] Redeploy failed for ${site.name}:`, e);
        const logPath = getDeploymentLogPath(site.userId, site.id, deployment.id);
        await appendDeploymentLog(
          logPath,
          `Deployment failed: ${e instanceof Error ? e.message : "Unknown error"}`
        ).catch(() => {});
        await prisma.$transaction([
          prisma.site.update({ where: { id: site.id }, data: { status: DEPLOYMENT_STATUS.FAILED } }),
          prisma.deployment.update({
            where: { id: deployment.id },
            data: { status: DEPLOYMENT_STATUS.FAILED },
          }),
        ]).catch(() => {});
      }
    })();
  }

  if (processedSites === 0) {
    return NextResponse.json({ message: `Ignoring push to ${pushedBranch}; no sites track that branch.` });
  }

  return NextResponse.json({ success: true, message: `Webhook processed for ${processedSites} site(s)` });
}
