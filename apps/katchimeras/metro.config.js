const { getSentryExpoConfig } = require('@sentry/react-native/metro');
const { createHash } = require('node:crypto');

const config = getSentryExpoConfig(__dirname);
// Production transforms inline these values. Give each public environment its
// own cache so switching from preview/export/embedded mode cannot reuse old flags.
const publicEnvironment = Object.keys(process.env).filter(key => key.startsWith('EXPO_PUBLIC_')).sort()
  .map(key => [key, process.env[key]]);
const environmentHash = createHash('sha256').update(JSON.stringify(publicEnvironment)).digest('hex');
config.cacheVersion = `${config.cacheVersion ?? '1'}:public-env:${environmentHash}`;

module.exports = config;
