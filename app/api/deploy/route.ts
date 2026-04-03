import { auth } from "@/auth";
import {
  createContainerName,
  createDockerPort,
  DEPLOYMENT_SOURCE,
  DEPLOYMENT_STATUS,
} from "@/lib/deployments";
import {
  createInstallCommand,
  execAsync,
  resolveDeployConfig,
} from "@/lib/build-runner";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl, getWebhookSecret } from "@/lib/env";
import { getPlanConfig } from "@/lib/plans";
import { getCustomersDiskUsageBytes } from "@/lib/usage";
import { appendDeploymentLog, getDeploymentLogPath, runLoggedCommand } from "@/lib/deployment-logs";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import {
  isDeployableServiceType,
  isSupportedDeployMode,
  isSupportedServiceType,
  sanitizeBranch,
  sanitizeCommand,
  sanitizeProjectName,
} from "@/lib/site-config";

type GitHubWebhook = {
  id?: number;
  active?: boolean;
  config?: {
    url?: string;
    content_type?: string;
  };
};

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Unknown error";
}

function isPixlWebhook(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.pathname === "/api/webhook/github";
  } catch {
    return false;
  }
}

function generateSubdomain(repoName: string) {
  return `${repoName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Math.floor(Math.random() * 1000)}`;
}

function isValidGitHubRepoUrl(repoUrl: string) {
  try {
    const parsed = new URL(repoUrl);
    return parsed.protocol === "https:" && parsed.hostname === "github.com" && parsed.pathname.split("/").filter(Boolean).length >= 2;
  } catch {
    return false;
  }
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      repoUrl?: string;
      providerId?: string;
      name?: string;
      serviceType?: string;
      deployMode?: string;
      branch?: string;
      installCommand?: string;
      buildCommand?: string;
      startCommand?: string;
    };
    const repoUrl = body.repoUrl?.trim();
    const providerId = body.providerId?.trim();
    const name = body.name ? sanitizeProjectName(body.name) : "";
    const serviceType = body.serviceType?.trim();
    const deployMode = body.deployMode?.trim();
    const branch = sanitizeBranch(body.branch);
    const installCommand = sanitizeCommand(body.installCommand);
    const buildCommand = sanitizeCommand(body.buildCommand);
    const startCommand = sanitizeCommand(body.startCommand);

    if (!repoUrl || !isValidGitHubRepoUrl(repoUrl)) {
      return NextResponse.json({ error: "Invalid GitHub repository URL" }, { status: 400 });
    }

    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
    }

    if (!isSupportedServiceType(serviceType)) {
      return NextResponse.json({ error: "Invalid service type" }, { status: 400 });
    }

    if (!isDeployableServiceType(serviceType)) {
      return NextResponse.json({ error: "Database services are coming soon." }, { status: 400 });
    }

    if (!isSupportedDeployMode(deployMode)) {
      return NextResponse.json({ error: "Invalid deploy mode" }, { status: 400 });
    }

    const userId = session.user.id;
    const [user, existingProjects, currentStorageBytes] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { plan: true },
      }),
      prisma.site.count({ where: { userId } }),
      getCustomersDiskUsageBytes(userId),
    ]);
    const plan = getPlanConfig(user?.plan);

    if (existingProjects >= plan.maxProjects) {
      return NextResponse.json(
        { error: `${plan.name} plan limit reached. You can deploy up to ${plan.maxProjects} projects.` },
        { status: 403 }
      );
    }

    if (currentStorageBytes >= plan.maxProjectStorageBytes) {
      return NextResponse.json(
        { error: `${plan.name} plan storage limit reached. Please remove a project or upgrade your plan.` },
        { status: 403 }
      );
    }

    const subdomain = generateSubdomain(name);

    const { site, deployment } = await prisma.$transaction(async (tx) => {
      const dockerPort = createDockerPort();
      const createdSite = await tx.site.create({
        data: {
          name,
          repoUrl,
          providerId,
          dockerPort,
          subdomain,
          serviceType,
          deployMode,
          branch,
          installCommand,
          buildCommand,
          startCommand,
          userId,
        }
      });

      const createdDeployment = await tx.deployment.create({
        data: {
          siteId: createdSite.id,
          status: DEPLOYMENT_STATUS.BUILDING,
          source: DEPLOYMENT_SOURCE.GITHUB_IMPORT,
          dockerPort,
          branch,
          isCurrent: true,
        },
      });

      return { site: createdSite, deployment: createdDeployment };
    });

    // Background compilation
    (async () => {
      try {
        const customersDir = path.join(process.cwd(), "customers", userId);
        const repoPath = path.join(customersDir, site.id);
        await fs.mkdir(repoPath, { recursive: true });
        const logPath = getDeploymentLogPath(userId, site.id, deployment.id);
        await appendDeploymentLog(logPath, `Starting initial deployment for ${repoUrl}`);

        const account = await prisma.account.findFirst({
          where: { userId, provider: "github" },
        });

        let cloneUrl = repoUrl;
        if (account?.access_token) {
           try {
             const urlObj = new URL(repoUrl);
             urlObj.username = "oauth2";
             urlObj.password = account.access_token;
             cloneUrl = urlObj.toString();
           } catch (e) {
             console.error("Failed to parse repoUrl URL", e);
           }
        }

        console.log(`Cloning ${repoUrl} to ${repoPath}...`);
        await runLoggedCommand(`git clone ${cloneUrl} .`, repoPath, logPath);
        await runLoggedCommand(`git checkout ${branch}`, repoPath, logPath).catch(() => {});

        const storageAfterClone = await getCustomersDiskUsageBytes(userId);
        if (storageAfterClone > plan.maxProjectStorageBytes) {
          await fs.rm(repoPath, { recursive: true, force: true }).catch(() => {});
          throw new Error(`${plan.name} plan storage limit exceeded for project storage.`);
        }

        const resolvedConfig = await resolveDeployConfig(repoPath, {
          installCommand: site.installCommand ?? createInstallCommand(await fs.readdir(repoPath)),
          buildCommand: site.buildCommand,
          startCommand: site.startCommand,
        });

        if (resolvedConfig.generatedDockerfile) {
          await fs.writeFile(path.join(repoPath, "Dockerfile"), resolvedConfig.generatedDockerfile);
        }

        const imageName = createContainerName(deployment.id);
        console.log(`Building Docker image ${imageName}...`);
        await runLoggedCommand(`docker build -t ${imageName} .`, repoPath, logPath);

        console.log(`Running Docker container ${imageName} on port ${deployment.dockerPort}...`);
        await runLoggedCommand(
          `docker run -d -p ${deployment.dockerPort}:${resolvedConfig.internalPort} --name ${imageName} ${imageName}`,
          repoPath,
          logPath
        );

        console.log(`Deployment ${site.id} successful`);
        await appendDeploymentLog(logPath, `Deployment is live on localhost:${deployment.dockerPort}`);
        await prisma.$transaction([
          prisma.site.update({
            where: { id: site.id },
            data: {
              status: DEPLOYMENT_STATUS.READY,
              dockerPort: deployment.dockerPort,
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

        // Auto-register GitHub webhook for automatic redeployment on push
        const publicUrl = getPublicAppUrl();
        const webhookSecret = getWebhookSecret();
        if (publicUrl && account?.access_token) {
          try {
            const repoPath = repoUrl.replace("https://github.com/", "");
            const webhookUrl = `${publicUrl}/api/webhook/github`;
            const existingHooks = await fetch(
              `https://api.github.com/repos/${repoPath}/hooks`,
              { headers: { Authorization: `Bearer ${account.access_token}`, Accept: "application/vnd.github.v3+json" } }
            ).then((response) => response.json() as Promise<GitHubWebhook[]>);
            const matchingHook = Array.isArray(existingHooks)
              ? existingHooks.find((hook) => hook.config?.url === webhookUrl)
              : undefined;
            const stalePixlHook = Array.isArray(existingHooks)
              ? existingHooks.find((hook) => hook.config?.url && isPixlWebhook(hook.config.url))
              : undefined;

            if (matchingHook) {
              console.log(`GitHub webhook already exists for ${repoPath}`);
            } else if (stalePixlHook?.id) {
              const updateRes = await fetch(`https://api.github.com/repos/${repoPath}/hooks/${stalePixlHook.id}`, {
                method: "PATCH",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                  Accept: "application/vnd.github.v3+json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  active: true,
                  events: ["push"],
                  config: {
                    url: webhookUrl,
                    content_type: "json",
                    secret: webhookSecret || "",
                    insecure_ssl: "0",
                  },
                }),
              });

              if (updateRes.ok) {
                console.log(`GitHub webhook updated for ${repoPath}`);
              } else {
                const err = await updateRes.json() as { message?: string };
                console.warn(`Failed to update webhook for ${repoPath}:`, err.message ?? "Unknown GitHub API error");
              }
            } else {
              const hookRes = await fetch(`https://api.github.com/repos/${repoPath}/hooks`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${account.access_token}`,
                  Accept: "application/vnd.github.v3+json",
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: "web",
                  active: true,
                  events: ["push"],
                  config: {
                    url: webhookUrl,
                    content_type: "json",
                    secret: webhookSecret || "",
                    insecure_ssl: "0",
                  },
                }),
              });
              if (hookRes.ok) {
                console.log(`GitHub webhook registered for ${repoPath}`);
              } else {
                const err = await hookRes.json() as { message?: string };
                console.warn(`Failed to register webhook for ${repoPath}:`, err.message ?? "Unknown GitHub API error");
              }
            }
          } catch (hookErr) {
            console.warn("Could not register GitHub webhook:", hookErr);
          }
        } else {
          console.warn("Skipping GitHub webhook registration because PIXL_PUBLIC_URL or GitHub access token is missing.");
        }
      } catch (err) {
        console.error(`Deployment ${site.id} failed:`, err);
        const logPath = getDeploymentLogPath(userId, site.id, deployment.id);
        await appendDeploymentLog(
          logPath,
          `Deployment failed: ${err instanceof Error ? err.message : "Unknown error"}`
        ).catch(() => {});
        await prisma.$transaction([
          prisma.site.update({ where: { id: site.id }, data: { status: DEPLOYMENT_STATUS.FAILED } }),
          prisma.deployment.update({
            where: { id: deployment.id },
            data: { status: DEPLOYMENT_STATUS.FAILED },
          }),
        ]).catch(console.error);
      }
    })();

    return NextResponse.json({ success: true, site });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const siteId = searchParams.get("siteId");

    if (!siteId) {
      return NextResponse.json({ error: "Missing siteId" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({
      where: { id: siteId }
    });

    if (!site || site.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found or unauthorized" }, { status: 404 });
    }

    const deployments = await prisma.deployment.findMany({
      where: { siteId },
      select: { containerName: true },
    });

    // 1. Stop & Remove Docker containers running for this site
    try {
      for (const deployment of deployments) {
        if (!deployment.containerName) {
          continue;
        }

        await execAsync(`docker stop ${deployment.containerName}`).catch(() => {});
        await execAsync(`docker rm ${deployment.containerName}`).catch(() => {});
        await execAsync(`docker rmi ${deployment.containerName}`).catch(() => {});
      }
    } catch (e: unknown) {
      console.log(`Failed to stop containers for ${site.name}, some of them might not be running.`, getErrorMessage(e));
    }

    // 2. Clear out local physical storage customer directory
    try {
      const repoPath = path.join(process.cwd(), "customers", session.user.id, site.id);
      await fs.rm(repoPath, { recursive: true, force: true });
    } catch (e) {
      console.error(`Failed to delete directory for ${site.id}`, e);
    }

    // 3. Remove DB record
    await prisma.site.delete({
      where: { id: siteId }
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error(err);
    return NextResponse.json({ error: getErrorMessage(err) }, { status: 500 });
  }
}
