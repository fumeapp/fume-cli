const {expect, test} = require('@oclif/test')

describe('init', () => {
  test
  .stdout()
  .command(['init'])
  .it('runs init', ctx => {
    expect(ctx.stdout).to.contain('hello world')
  })

  test
  .stdout()
  .command(['hello', '--name', 'jeff'])
  .it('runs hello --name jeff', ctx => {
    expect(ctx.stdout).to.contain('hello jeff')
  })
})
