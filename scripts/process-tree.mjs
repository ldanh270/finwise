import { spawn } from "node:child_process";

/**
 * Stop a child process and every process it owns when the platform supports
 * process-tree termination. Windows starts pnpm.cmd through cmd.exe, so
 * child.kill() alone leaves the nested Next/Nest process listening on a port.
 */
export function stopProcessTree(
  child,
  { platform = process.platform, spawnProcess = spawn } = {},
) {
  if (!child || typeof child.kill !== "function") {
    return;
  }

  if (platform === "win32" && child.pid) {
    try {
      const terminator = spawnProcess(
        "taskkill",
        ["/pid", String(child.pid), "/T", "/F"],
        { stdio: "ignore", windowsHide: true },
      );
      terminator?.on?.("error", () => child.kill());
      return;
    } catch {
      // Fall back to the direct child signal if taskkill cannot be started.
    }
  }

  child.kill();
}
