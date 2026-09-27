const { spawn } = require('node:child_process');
const path = require('node:path');
const net = require('node:net');

// Keep the installed custom client (and its native libraries), but serve a
// production-mode JS bundle. Pin the workspace even when launched from the root.
const projectRoot = path.resolve(__dirname, '..');
const expoRoot = path.dirname(require.resolve('expo/package.json'));
const expoCli = path.resolve(expoRoot, require('expo/package.json').bin.expo);
const args = ['start', '--dev-client', '--no-dev', '--minify', ...process.argv.slice(2)];

console.log('Katchimeras dev client: production-mode JS, four-finger tools on, diagnostics off.');
console.log('For normal debugging / Fast Refresh: npm run start:dev-client:debug');

function start() {
  const child = spawn(process.execPath, [expoCli, ...args], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      // Existing process values take precedence over Expo's .env.local, without
      // changing that file or any gameplay / scene experiment flags.
      EXPO_PUBLIC_ENABLE_DIAGNOSTICS: '0',
      EXPO_PUBLIC_COMBAT_PROFILE: '0',
      // Match the preview build's in-app tools without enabling instrumentation.
      EXPO_PUBLIC_ENABLE_DEV_TOOLS: 'true',
      // Production-mode native JS cannot resolve Metro's lazy chunk URLs.
      // Include dynamic-import dependencies in the initial bundle instead.
      EXPO_NO_METRO_LAZY: '1',
    },
  });

  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  process.on('SIGINT', () => child.kill('SIGINT'));
  process.on('SIGTERM', () => child.kill('SIGTERM'));
}

// Do not silently offer a second Metro port while the phone is using the first.
const portOption = args.findIndex(arg => arg === '--port' || arg === '-p');
const port = Number(portOption >= 0 ? args[portOption + 1] : args.find(arg => arg.startsWith('--port='))?.slice(7) ?? 8081);
if (args.includes('--help') || args.includes('-h') || !Number.isInteger(port) || port <= 0 || port > 65535) {
  start();
} else {
  const probe = net.createConnection({ host: '127.0.0.1', port });
  probe.once('connect', () => {
    probe.destroy();
    console.log(`Port ${port} is already in use. Reuse the running Metro server, or stop it before restarting. No second server was started.`);
  });
  probe.once('error', error => {
    if (error.code === 'ECONNREFUSED') start();
    else { console.error(`Could not check Metro port ${port}: ${error.message}`); process.exitCode = 1; }
  });
  probe.setTimeout(1500, () => {
    probe.destroy();
    console.error(`Could not check Metro port ${port}. No second server was started.`);
    process.exitCode = 1;
  });
}
