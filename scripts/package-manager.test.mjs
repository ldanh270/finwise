import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildPackageCommand,
  resolvePackageManager,
} from './package-manager.mjs';

const application = {
  directory: 'C:\\finwise\\backend',
  script: 'start:prod',
  pnpmArgs: ['--filter', 'backend', 'start:prod'],
};

test('npm lifecycle metadata selects standalone npm commands', () => {
  assert.equal(
    resolvePackageManager({ userAgent: 'npm/11.5.1 node/v22.22.3 win32 x64' }),
    'npm',
  );
  assert.deepEqual(
    buildPackageCommand({
      packageManager: 'npm',
      platform: 'win32',
      application,
    }),
    {
      command: 'npm.cmd',
      args: ['--prefix', 'C:\\finwise\\backend', 'run', 'start:prod'],
    },
  );
});

test('pnpm remains the workspace default and can be selected explicitly', () => {
  assert.equal(resolvePackageManager({ userAgent: 'pnpm/11.15.1' }), 'pnpm');
  assert.equal(
    resolvePackageManager({
      requestedManager: ' pnpm ',
      userAgent: 'npm/11.5.1',
    }),
    'pnpm',
  );
  assert.deepEqual(
    buildPackageCommand({
      packageManager: 'pnpm',
      platform: 'linux',
      application,
    }),
    {
      command: 'pnpm',
      args: ['--filter', 'backend', 'start:prod'],
    },
  );
});
