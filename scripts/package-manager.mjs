const SUPPORTED_PACKAGE_MANAGERS = new Set(['npm', 'pnpm']);

/**
 * Resolve the package manager for the combined app runner without coupling it
 * to a shell-specific command. An explicit override is useful in CI; local
 * npm/pnpm lifecycle metadata provides the default.
 */
export function resolvePackageManager({ requestedManager, userAgent } = {}) {
  const requested = requestedManager?.trim().toLowerCase();
  if (requested && SUPPORTED_PACKAGE_MANAGERS.has(requested)) {
    return requested;
  }

  return userAgent?.startsWith('npm/') ? 'npm' : 'pnpm';
}

export function buildPackageCommand({ packageManager, platform, application }) {
  const npmCommand = platform === 'win32' ? 'npm.cmd' : 'npm';
  const pnpmCommand = platform === 'win32' ? 'pnpm.cmd' : 'pnpm';

  if (packageManager === 'npm') {
    return {
      command: npmCommand,
      args: ['--prefix', application.directory, 'run', application.script],
    };
  }

  return { command: pnpmCommand, args: application.pnpmArgs };
}
