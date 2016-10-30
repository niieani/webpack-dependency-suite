export function configure(aurelia) {
  aurelia.use
    .standardConfiguration()
    .developmentLogging();

  aurelia.start().then(aurelia.setRoot(/* @import */ 'app'));
}

// const context = require.context('./sub', true, /\.(ts|js)/);
// console.log(context.keys())
