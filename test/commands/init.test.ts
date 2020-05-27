import {expect, test} from '@oclif/test'

describe('init', () => {
  test
  .stdout()
  .command(['init', '--name', 'bob'])
  .it('runs init --name bob', ctx => {
    expect(ctx.stdout).to.contain('')
  })
})
