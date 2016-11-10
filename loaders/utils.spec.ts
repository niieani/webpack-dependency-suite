import { expandGlobBase } from './inject-utils';
import { getResourcesFromList } from './utils';

describe('Resouce handling - ', () => {
  it(`loading`, () => {
    const resources = getResourcesFromList(require(`../package.json`), '_test.resources')
    // console.log(resources)
    expect(resources).toBeTruthy()
    expect(resources.length).toBe(4)
  })
  // it(`globbing`, (done) => {
  //   expandGlobBase
  //   const resources = getResourcesFromList(require(`../package.json`), '_test.resources')
  //   // console.log(resources)
  //   expect(resources).toBeTruthy()
  //   expect(resources.length).toBe(4)
  // })
})
