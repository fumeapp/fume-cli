import {expect, test} from '@oclif/test'

describe('config', () => {
  test
  .stdout()
  .command(['config', '-h'])
  .it('runs config -h', ctx => {
    expect(ctx.stdout).to.contain('config')
  })
})
