module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    // Unistyles processes the StyleSheets of files under src/.
    plugins: [['react-native-unistyles/plugin', { root: 'src' }]],
    presets: ['babel-preset-expo'],
  };
};
