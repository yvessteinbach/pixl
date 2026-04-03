import { auth } from "@/auth";
import {
  createContainerName,
  createDockerPort,
  DEPLOYMENT_SOURCE,
  DEPLOYMENT_STATUS,
} from "@/lib/deployments";
import { createInstallCommand, resolveDeployConfig } from "@/lib/build-runner";
import { appendDeploymentLog, getDeploymentLogPath, runLoggedCommand } from "@/lib/deployment-logs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await req.json()) as { siteId?: string };
    const siteId = body.siteId?.trim();

    if (!siteId) {
      return NextResponse.json({ error: "Missing site id" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      include: {
        deployments: {
          where: { isCurrent: true },
        },
      },
    });

    if (!site || site.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const dockerPort = site.dockerPort ?? createDockerPort();
    const deployment = await prisma.$transaction(async (tx) => {
      const createdDeployment = await tx.deployment.create({
        data: {
          siteId: site.id,
          status: DEPLOYMENT_STATUS.BUILDING,
          source: DEPLOYMENT_SOURCE.WEBHOOK_PUSH,
          dockerPort,
          branch: site.pendingCommitBranch ?? site.branch,
          commitSha: site.pendingCommitSha ?? undefined,
        },
      });

      await tx.site.update({
        where: { id: site.id },
        data: {
          status: DEPLOYMENT_STATUS.BUILDING,
          pendingCommitAt: null,
          pendingCommitBranch: null,
          pendingCommitSha: null,
        },
      });

      return createdDeployment;
    });

    (async () => {
      try {
        const repoPath = path.join(process.cwd(), "customers", site.userId, site.id);
        const logPath = getDeploymentLogPath(site.userId, site.id, deployment.id);
        const imageName = createContainerName(deployment.id);
        await appendDeploymentLog(logPath, `Starting manual deployment for ${site.name}`);
        const previousCurrentDeployments = await prisma.deployment.findMany({
          where: {
            siteId: site.id,
            isCurrent: true,
            id: { not: deployment.id },
          },
        });

        await runLoggedCommand(`git checkout ${site.branch}`, repoPath, logPath).catch(() => {});
        await runLoggedCommand("git pull", repoPath, logPath);

        const resolvedConfig = await resolveDeployConfig(repoPath, {
          installCommand: site.installCommand ?? createInstallCommand(await fs.readdir(repoPath)),
          buildCommand: site.buildCommand,
          startCommand: site.startCommand,
        });

        if (resolvedConfig.generatedDockerfile) {
          await fs.writeFile(path.join(repoPath, "Dockerfile"), resolvedConfig.generatedDockerfile);
        }

        await runLoggedCommand(`docker build -t ${imageName} .`, repoPath, logPath);

        // This project keeps one stable external port, so the previous live
        // container must release that port before the replacement can start.
        for (const oldDeployment of previousCurrentDeployments) {
          if (!oldDeployment.containerName) continue;
          await runLoggedCommand(`docker stop ${oldDeployment.containerName}`, repoPath, logPath).catch(() => {});
          await runLoggedCommand(`docker rm ${oldDeployment.containerName}`, repoPath, logPath).catch(() => {});
        }

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
            data: { status: DEPLOYMENT_STATUS.READY },
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

      } catch (error) {
        console.error(`[Manual deploy] failed for ${site.name}:`, error);
        const logPath = getDeploymentLogPath(site.userId, site.id, deployment.id);
        await appendDeploymentLog(
          logPath,
          `Deployment failed: ${error instanceof Error ? error.message : "Unknown error"}`
        ).catch(() => {});
        await prisma.$transaction([
          prisma.site.update({
            where: { id: site.id },
            data: { status: DEPLOYMENT_STATUS.FAILED },
          }),
          prisma.deployment.update({
            where: { id: deployment.id },
            data: { status: DEPLOYMENT_STATUS.FAILED },
          }),
        ]).catch(() => {});
      }
    })();

    return NextResponse.json({ success: true, deploymentId: deployment.id });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId")?.trim();

    if (!siteId) {
      return NextResponse.json({ error: "Missing site id" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId },
      select: {
        id: true,
        userId: true,
        pendingCommitSha: true,
      },
    });

    if (!site || site.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (!site.pendingCommitSha) {
      return NextResponse.json({ error: "No pending commit to decline" }, { status: 400 });
    }

    await prisma.site.update({
      where: { id: site.id },
      data: {
        pendingCommitAt: null,
        pendingCommitBranch: null,
        pendingCommitSha: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
