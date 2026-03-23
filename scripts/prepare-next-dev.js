const fs = require('fs');
const net = require('net');
const path = require('path');

const projectRoot = process.cwd();
const distDir = process.env.NEXT_DIST_DIR || '.next';
const nextDir = path.join(projectRoot, distDir);
const targetPort = Number(process.env.PORT || 3000);
const forceClean = process.env.FORCE_NEXT_DEV_CLEAN === '1';

const isPortInUse = (port) =>
  new Promise((resolve) => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      resolve(false);
    });
  });

const run = async () => {
  const portInUse = await isPortInUse(targetPort);

  if (portInUse && !forceClean) {
    console.log(
      `[prepare-next-dev] Port ${targetPort} is already in use. Skipping ${distDir} cleanup to avoid breaking a running dev server.`,
    );
    console.log(
      '[prepare-next-dev] If you need a full cleanup anyway, stop the other server first or run with FORCE_NEXT_DEV_CLEAN=1.',
    );
    return;
  }

  try {
    // Clear stale Next.js build/runtime artifacts that can cause
    // "Cannot find module './xxxx.js'" during dev HMR reloads.
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors.
  }

  console.log(`[prepare-next-dev] Ready. Using dist dir: ${distDir}`);
};

run().catch((error) => {
  console.error('[prepare-next-dev] Unexpected error:', error);
  process.exit(1);
});
