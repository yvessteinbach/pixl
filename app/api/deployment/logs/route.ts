import { auth } from "@/auth";
import { getDeploymentLogPath, readDeploymentLog } from "@/lib/deployment-logs";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const deploymentId = searchParams.get("deploymentId")?.trim();

  if (!deploymentId) {
    return NextResponse.json({ error: "Missing deploymentId" }, { status: 400 });
  }

  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: {
      site: {
        select: {
          id: true,
          userId: true,
        },
      },
    },
  });

  if (!deployment || deployment.site.userId !== session.user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const content = await readDeploymentLog(
    getDeploymentLogPath(deployment.site.userId, deployment.site.id, deployment.id)
  );

  return NextResponse.json({ content, status: deployment.status });
}
