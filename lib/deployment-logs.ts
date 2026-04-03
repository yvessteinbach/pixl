import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

function timestamp() {
  return new Date().toISOString();
}

export function getDeploymentLogDir(userId: string, siteId: string) {
  return path.join(process.cwd(), "customers", userId, siteId, ".pixl", "deployments");
}

export function getDeploymentLogPath(userId: string, siteId: string, deploymentId: string) {
  return path.join(getDeploymentLogDir(userId, siteId), `${deploymentId}.log`);
}

export async function appendDeploymentLog(logPath: string, message: string) {
  await fs.mkdir(path.dirname(logPath), { recursive: true });
  await fs.appendFile(logPath, `[${timestamp()}] ${message}\n`);
}

export async function readDeploymentLog(logPath: string) {
  try {
    return await fs.readFile(logPath, "utf-8");
  } catch {
    return "";
  }
}

export async function runLoggedCommand(cmd: string, cwd: string | undefined, logPath: string) {
  await appendDeploymentLog(logPath, `$ ${cmd}`);

  return new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    exec(cmd, { cwd }, async (error, stdout, stderr) => {
      const output = [stdout?.trim(), stderr?.trim()].filter(Boolean).join("\n");

      if (output) {
        await appendDeploymentLog(logPath, output);
      }

      if (error) {
        await appendDeploymentLog(logPath, `Command failed: ${error.message}`);
        reject(error);
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}
