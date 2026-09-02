import { spawn } from 'node:child_process';
import process from 'node:process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stopProcessTree } from './process-tree.mjs';

const mode = process.argv[2];

if (mode !== 'dev' && mode !== 'start') {
  console.error('Usage: node scripts/run-apps.mjs <dev|start>');
  process.exit(1);
}

const rootDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const pnpmCommand = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const isDevelopment = mode === 'dev';
const children = [];
let isShuttingDown = false;

const applications = [
  {
    name: 'backend',
    args: ['--filter', 'backend', isDevelopment ? 'start:dev' : 'start:prod'],
    env: { PORT: process.env.BACKEND_PORT ?? '3001' },
  },
  {
    name: 'frontend',
    args: ['--filter', 'frontend', isDevelopment ? 'dev' : 'start'],
    env: { PORT: process.env.FRONTEND_PORT ?? '3000' },
  },
];

function stopApplications(exitCode) {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;
  for (const child of children) {
    stopProcessTree(child);
  }

  setTimeout(() => process.exit(exitCode), 1000).unref();
}

function writeOutput(applicationName, chunk) {
  const lines = chunk.toString().split(/(?<=\n)/);
  for (const line of lines) {
    if (line.length > 0) {
      process.stdout.write(`[${applicationName}] ${line}`);
    }
  }
}

for (const application of applications) {
  const child = spawn(pnpmCommand, application.args, {
    cwd: rootDirectory,
    env: { ...process.env, ...application.env },
    // Windows cannot spawn a .cmd shim directly with Node's default mode.
    // The arguments here are fixed workspace scripts, so shell dispatch does
    // not expose user-controlled command text.
    shell: process.platform === 'win32',
    stdio: ['inherit', 'pipe', 'pipe'],
  });

  child.stdout.on('data', (chunk) => writeOutput(application.name, chunk));
  child.stderr.on('data', (chunk) => writeOutput(application.name, chunk));
  child.on('error', (error) => {
    console.error(`[${application.name}] ${error.message}`);
    stopApplications(1);
  });
  child.on('exit', (exitCode, signal) => {
    if (isShuttingDown || exitCode === 0) {
      return;
    }

    const reason = signal
      ? `signal ${signal}`
      : `exit code ${exitCode ?? 1}`;
    console.error(
      `[${application.name}] process stopped unexpectedly (${reason}).`,
    );
    stopApplications(exitCode ?? 1);
  });

  children.push(child);
}

process.on('SIGINT', () => stopApplications(0));
process.on('SIGTERM', () => stopApplications(0));
