import { exec } from "child_process";
import fs from "fs/promises";
import path from "path";

export type PackageJson = {
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

export type ResolvedDeployConfig = {
  installCommand: string;
  buildCommand: string | null;
  startCommand: string | null;
  internalPort: number;
  generatedDockerfile: string | null;
};

export async function execAsync(cmd: string, cwd?: string): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve({ stdout, stderr });
      }
    });
  });
}

export function shellEscape(value: string) {
  return value.replace(/"/g, '\\"');
}

export function createInstallCommand(files: string[]) {
  if (files.includes("pnpm-lock.yaml")) return "corepack enable && pnpm install --frozen-lockfile";
  if (files.includes("yarn.lock")) return "corepack enable && yarn install --frozen-lockfile";
  if (files.includes("package-lock.json")) return "npm ci --legacy-peer-deps";
  return "npm install --legacy-peer-deps";
}

function getDetectedCommands(pkg: PackageJson, deps: Record<string, string>) {
  const scripts = pkg.scripts ?? {};
  const hasBuild = Boolean(scripts.build);
  const hasStart = Boolean(scripts.start);
  const hasPreview = Boolean(scripts.preview);
  const hasDev = Boolean(scripts.dev);
  const isNextJs = Boolean(deps.next);
  const isViteOrReact = Boolean(deps.vite || deps["react-scripts"]);

  if (isViteOrReact) {
    return {
      buildCommand: hasBuild ? "npm run build" : null,
      startCommand: null,
      internalPort: 80,
      shouldServeStaticBuild: true,
      fallbackMode: null as string | null,
    };
  }

  if (isNextJs) {
    return {
      buildCommand: hasBuild ? "npm run build" : "npx next build",
      startCommand: hasStart ? "npm run start" : "npx next start -H 0.0.0.0 -p 3000",
      internalPort: 3000,
      shouldServeStaticBuild: false,
      fallbackMode: null as string | null,
    };
  }

  if (hasBuild && hasStart) {
    return {
      buildCommand: "npm run build",
      startCommand: "npm run start",
      internalPort: 3000,
      shouldServeStaticBuild: false,
      fallbackMode: null as string | null,
    };
  }

  if (hasStart) {
    return {
      buildCommand: hasBuild ? "npm run build" : null,
      startCommand: "npm run start",
      internalPort: 3000,
      shouldServeStaticBuild: false,
      fallbackMode: null as string | null,
    };
  }

  if (hasPreview) {
    return {
      buildCommand: hasBuild ? "npm run build" : null,
      startCommand: "npm run preview -- --host 0.0.0.0 --port 3000",
      internalPort: 3000,
      shouldServeStaticBuild: false,
      fallbackMode: "preview",
    };
  }

  if (hasDev) {
    return {
      buildCommand: hasBuild ? "npm run build" : null,
      startCommand: "npm run dev -- --host 0.0.0.0 --port 3000",
      internalPort: 3000,
      shouldServeStaticBuild: false,
      fallbackMode: "dev",
    };
  }

  return {
    buildCommand: null,
    startCommand: null,
    internalPort: 3000,
    shouldServeStaticBuild: false,
    fallbackMode: null as string | null,
  };
}

export async function resolveDeployConfig(repoPath: string, options?: {
  installCommand?: string | null;
  buildCommand?: string | null;
  startCommand?: string | null;
}) {
  const files = await fs.readdir(repoPath);
  const hasPackageJson = files.includes("package.json");
  const installCommand = options?.installCommand?.trim() || createInstallCommand(files);

  let deps: Record<string, string> = {};
  let pkg: PackageJson = {};

  if (files.includes("package.json")) {
    const pkgContent = await fs.readFile(path.join(repoPath, "package.json"), "utf-8");
    pkg = JSON.parse(pkgContent) as PackageJson;
    deps = { ...pkg.dependencies, ...pkg.devDependencies };

  }

  const detectedCommands = getDetectedCommands(pkg, deps);
  const buildCommand = options?.buildCommand?.trim() || detectedCommands.buildCommand || "npm run build";
  const startCommand = options?.startCommand?.trim() || detectedCommands.startCommand;

  if (files.includes("Dockerfile")) {
    let internalPort = 3000;
    try {
      const dockerfile = await fs.readFile(path.join(repoPath, "Dockerfile"), "utf-8");
      if (dockerfile.includes("FROM nginx:alpine") || dockerfile.includes("EXPOSE 80")) {
        internalPort = 80;
      }
    } catch {}

    return {
      installCommand,
      buildCommand,
      startCommand,
      internalPort,
      generatedDockerfile: null,
    } satisfies ResolvedDeployConfig;
  }

  if (detectedCommands.shouldServeStaticBuild && !options?.startCommand?.trim()) {
    const buildDir = deps.vite ? "dist" : "build";
    return {
      installCommand,
      buildCommand,
      startCommand: null,
      internalPort: 80,
      generatedDockerfile: `
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN ${installCommand}
COPY . .
RUN ${buildCommand}

FROM nginx:alpine
COPY --from=builder /app/${buildDir} /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
`,
    } satisfies ResolvedDeployConfig;
  }

  return {
    installCommand,
    buildCommand,
    startCommand,
    internalPort: detectedCommands.internalPort,
    generatedDockerfile: `
FROM node:20-slim
WORKDIR /app
COPY . .
${hasPackageJson ? `RUN ${installCommand}` : ""}
${buildCommand ? `RUN ${buildCommand}` : ""}
EXPOSE 3000
CMD ["sh", "-c", "${shellEscape(startCommand || "node -e \"throw new Error('No start command detected. Add a start script or configure a custom start command.')\"")}"]
`,
  } satisfies ResolvedDeployConfig;
}
