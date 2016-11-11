const tsc = require('typescript');
const tsConfig = require('../tsconfig.json');

module.exports = {
  process(src, path) {
    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      return tsc.transpile(
        src,
        Object.assign(tsConfig.compilerOptions, { target: 'es5' }),
        path,
        []
      );
    }
    return src;
  },
};
