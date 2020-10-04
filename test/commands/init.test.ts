import {expect, test} from '@oclif/test'

describe('init', () => {
  test
  .stdout()
  .command(['init', '-h'])
  .it('runs init -h', ctx => {
    expect(ctx.stdout).to.contain('Initialize')
  })
})
