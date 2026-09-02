import net from 'node:net';

/**
 * Probe a TCP port without keeping a listener open. A null result means the
 * operating system refused the probe for a reason other than the port being
 * occupied; callers should let the application produce the authoritative
 * startup error in that case.
 */
export function isPortAvailable(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (error) => {
      if (error?.code === 'EADDRINUSE') {
        resolve(false);
        return;
      }

      reject(error);
    });

    server.listen({ port }, () => {
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
          return;
        }

        resolve(true);
      });
    });
  });
}

/**
 * Return only ports that are already occupied. Probe failures unrelated to
 * EADDRINUSE are intentionally ignored so diagnostics never prevent the app
 * from attempting its own bind.
 */
export async function findPortConflicts(applications, inspectPort = isPortAvailable) {
  const conflicts = [];
  const inspectedPorts = new Map();

  for (const application of applications) {
    const port = application.port;
    let available = inspectedPorts.get(port);

    if (available === undefined) {
      try {
        available = await inspectPort(port);
      } catch {
        available = null;
      }
      inspectedPorts.set(port, available);
    }

    if (available === false) {
      conflicts.push({
        name: application.name,
        port,
        portEnv: application.portEnv,
      });
    }
  }

  return conflicts;
}
