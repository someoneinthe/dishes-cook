module.exports = function babelConfig(api) {
  api.cache(true);
  return {
    plugins: [
      // Unistyles processes the StyleSheets of files under src/.
      ['react-native-unistyles/plugin', { root: 'src' }],
      // Drizzle migrations: `import m0000 from './0000_x.sql'` becomes the file's content.
      ['inline-import', { extensions: ['.sql'] }],
    ],
    presets: ['babel-preset-expo'],
  };
};
