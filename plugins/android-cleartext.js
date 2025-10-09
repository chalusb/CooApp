const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withAndroidCleartextTraffic(config) {
  return withAndroidManifest(config, config => {
    const androidManifest = config.modResults;
    
    // Add usesCleartextTraffic="true" to application tag
    if (androidManifest.manifest && androidManifest.manifest.application) {
      androidManifest.manifest.application[0].$['android:usesCleartextTraffic'] = 'true';
    }
    
    return config;
  });
};
