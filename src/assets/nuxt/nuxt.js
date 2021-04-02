const { Nuxt } = require('./nuxt-start');

const { runTransform } = require('./core.js')

const input = `import { config } from "../nuxt.config.js";`
const config = runTransform(input)

const nuxt = new Nuxt({ ...config, dev: false });

module.exports = (req, res) =>
  nuxt.ready().then(() => nuxt.server.app(req, res));
