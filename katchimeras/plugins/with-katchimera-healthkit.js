const { IOSConfig, createRunOncePlugin, withEntitlementsPlist } = require('expo/config-plugins');

const DEFAULT_HEALTH_SHARE_PERMISSION =
  'Katchimeras can read your workout routes from Apple Health when you choose to import a walk into a memory map.';

function withKatchimeraHealthKit(config, props = {}) {
  IOSConfig.Permissions.createPermissionsPlugin({
    NSHealthShareUsageDescription: DEFAULT_HEALTH_SHARE_PERMISSION,
  })(config, {
    NSHealthShareUsageDescription: props.healthSharePermission,
  });

  return withEntitlementsPlist(config, (entitlementsConfig) => {
    entitlementsConfig.modResults = entitlementsConfig.modResults || {};
    entitlementsConfig.modResults['com.apple.developer.healthkit'] = true;
    return entitlementsConfig;
  });
}

module.exports = createRunOncePlugin(withKatchimeraHealthKit, 'with-katchimera-healthkit', '1.0.0');
