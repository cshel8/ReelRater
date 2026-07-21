const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite's alpha web implementation loads its database engine as WASM.
config.resolver.assetExts.push('wasm');

module.exports = config;
