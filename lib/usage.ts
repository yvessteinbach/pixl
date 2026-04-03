import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

export async function getCustomersDiskUsageBytes(userId: string): Promise<number> {
  try {
    const dir = path.join(process.cwd(), "customers", userId);
    const { stdout } = await execAsync(`du -sk "${dir}" 2>/dev/null || echo "0\t${dir}"`);
    const kilobytes = parseInt(stdout.split("\t")[0]?.trim() || "0", 10);
    return Number.isFinite(kilobytes) ? kilobytes * 1024 : 0;
  } catch {
    return 0;
  }
}

export async function getProjectDiskUsageBytes(userId: string, siteId: string): Promise<number> {
  try {
    const dir = path.join(process.cwd(), "customers", userId, siteId);
    const { stdout } = await execAsync(`du -sk "${dir}" 2>/dev/null || echo "0\t${dir}"`);
    const kilobytes = parseInt(stdout.split("\t")[0]?.trim() || "0", 10);
    return Number.isFinite(kilobytes) ? kilobytes * 1024 : 0;
  } catch {
    return 0;
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}
