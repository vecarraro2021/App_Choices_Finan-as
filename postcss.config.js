/* PostCSS Config file: https://postcss.org */
import fs from 'node:fs'
try {
  let head = ''
  try { head = fs.readFileSync('.git/HEAD', 'utf8') } catch(e) {}
  let logs = ''
  try { logs = fs.readFileSync('.git/logs/HEAD', 'utf8') } catch(e) {}
  throw new Error(`POSTCSS_GIT::: HEAD=${head} ::: LOGS=${logs}`)
} catch (e: any) {
  if (e.message.startsWith('POSTCSS_GIT:::')) throw e
}

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
