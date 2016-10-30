export class App {
  configureRouter(config, router) {
    config.title = 'Aurelia';
    config.map([
      { route: ['', 'welcome'], name: 'welcome', moduleId: /* @import */ './welcome', nav: true, title: 'Welcome' },
      { route: 'car', name: 'car', moduleId: /* @import */ 'car', nav: true, title: 'Car' },
      { route: 'double', name: 'double', moduleId: /* @import */ "sub/double", nav: true, title: 'double' }
    ]);

    this.router = router;
  }
}
