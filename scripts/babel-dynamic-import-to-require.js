// Babel plugin for Jest (jest.config.js), which runs CommonJS without Node's ES module loader:
// `import('x')` (the parts of the web app it loads only when needed, e.g.
// src/features/recipes/read-document.web.ts) becomes `Promise.resolve().then(() => require('x'))`,
// which jest.mock replaces as usual. Its own file: Jest's workers get the plugin by its path.
module.exports = function dynamicImportToRequire({ types }) {
  return {
    visitor: {
      CallExpression(path) {
        if (path.node.callee.type !== 'Import') {
          return;
        }
        const promiseResolve = types.memberExpression(
          types.identifier('Promise'),
          types.identifier('resolve'),
        );
        const resolved = types.callExpression(promiseResolve, []);
        const required = types.callExpression(types.identifier('require'), path.node.arguments);
        const then = types.memberExpression(resolved, types.identifier('then'));
        path.replaceWith(types.callExpression(then, [types.arrowFunctionExpression([], required)]));
      },
    },
  };
};
