import assert from 'node:assert/strict';
import net from 'node:net';
import test from 'node:test';
import { findPortConflicts, isPortAvailable } from './port-preflight.mjs';

function listenOnEphemeralPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen({ port: 0 }, () => {
      const address = server.address();
      if (!address || typeof address === 'string') {
        server.close();
        reject(new Error('Expected an ephemeral TCP address'));
        return;
      }
      resolve({ server, port: address.port });
    });
  });
}

test('detects an occupied TCP port', async () => {
  const { server, port } = await listenOnEphemeralPort();
  try {
    assert.equal(await isPortAvailable(port), false);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});

test('reports an available ephemeral port', async () => {
  assert.equal(await isPortAvailable(0), true);
});

test('deduplicates the port probe and returns app diagnostics', async () => {
  const inspectedPorts = [];
  const applications = [
    { name: 'backend', port: 3001, portEnv: 'BACKEND_PORT' },
    { name: 'frontend', port: 3001, portEnv: 'FRONTEND_PORT' },
  ];

  const conflicts = await findPortConflicts(applications, async (port) => {
    inspectedPorts.push(port);
    return false;
  });

  assert.deepEqual(inspectedPorts, [3001]);
  assert.deepEqual(conflicts, [
    { name: 'backend', port: 3001, portEnv: 'BACKEND_PORT' },
    { name: 'frontend', port: 3001, portEnv: 'FRONTEND_PORT' },
  ]);
});
