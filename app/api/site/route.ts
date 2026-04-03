import { auth } from "@/auth";
import { DEPLOYMENT_STATUS } from "@/lib/deployments";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { exec } from "child_process";

function execAsync(cmd: string): Promise<string> {
  return new Promise((resolve) => {
    exec(cmd, (err, stdout) => resolve(stdout?.trim() || ""));
  });
}

function sanitizeProjectName(name: string) {
  return name.trim().replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const site = await prisma.site.findUnique({
    where: { id },
    include: {
      deployments: {
        orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
        take: 1,
      },
    },
  });
  if (!site) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const latestDeployment = site.deployments[0] ?? null;
  const currentStatus = latestDeployment?.status ?? site.status;

  // If still building, check Docker directly — background task may have completed
  if (currentStatus === DEPLOYMENT_STATUS.BUILDING) {
    const containerName = latestDeployment?.containerName ?? `pixl-${site.id}`;
    const dockerStatus = await execAsync(
      `docker inspect --format='{{.State.Status}}' ${containerName} 2>/dev/null`
    );

    if (dockerStatus === "running") {
      // Container is running — update DB and return READY
      await prisma.site.update({ where: { id }, data: { status: DEPLOYMENT_STATUS.READY } });
      if (latestDeployment) {
        await prisma.deployment.update({
          where: { id: latestDeployment.id },
          data: { status: DEPLOYMENT_STATUS.READY },
        });
      }
      return NextResponse.json({
        site: { ...site, status: DEPLOYMENT_STATUS.READY, latestDeployment: latestDeployment ? { ...latestDeployment, status: DEPLOYMENT_STATUS.READY } : null },
      });
    }

    // Check if the image even exists (build may have failed)
    const imageExists = await execAsync(
      `docker image inspect ${containerName} --format='{{.Id}}' 2>/dev/null`
    );
    if (!imageExists) {
      // No image, no container — if more than 10 minutes old, mark failed
      const ageMs = Date.now() - new Date((latestDeployment?.createdAt ?? site.createdAt)).getTime();
      if (ageMs > 10 * 60 * 1000) {
        await prisma.site.update({ where: { id }, data: { status: DEPLOYMENT_STATUS.FAILED } });
        if (latestDeployment) {
          await prisma.deployment.update({
            where: { id: latestDeployment.id },
            data: { status: DEPLOYMENT_STATUS.FAILED },
          });
        }
        return NextResponse.json({
          site: { ...site, status: DEPLOYMENT_STATUS.FAILED, latestDeployment: latestDeployment ? { ...latestDeployment, status: DEPLOYMENT_STATUS.FAILED } : null },
        });
      }
    }
  }

  return NextResponse.json({
    site: {
      ...site,
      status: currentStatus,
      latestDeployment,
    },
  });
}

export async function PATCH(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as { id?: string; name?: string };
    const id = body.id?.trim();
    const name = body.name ? sanitizeProjectName(body.name) : "";

    if (!id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }

    if (!name || name.length > 60) {
      return NextResponse.json({ error: "Invalid project name" }, { status: 400 });
    }

    const site = await prisma.site.findUnique({ where: { id } });
    if (!site || site.userId !== session.user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const updatedSite = await prisma.site.update({
      where: { id },
      data: { name },
    });

    return NextResponse.json({ success: true, site: updatedSite });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
  }
}
