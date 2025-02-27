/* eslint-env jest */

import fs from 'fs-extra'
import { join } from 'path'
import cheerio from 'cheerio'
import {
  killApp,
  findPort,
  nextBuild,
  initNextServerScript,
  renderViaHTTP,
  nextStart,
  waitFor,
  check,
} from 'next-test-utils'

const appDir = join(__dirname, '../')
const nextConfigPath = join(appDir, 'next.config.js')
let appPort
let buildId
let app
let stdout = ''

const checkAsPath = async (urlPath, expectedAsPath) => {
  const html = await renderViaHTTP(appPort, urlPath)
  const $ = cheerio.load(html)
  const asPath = $('#as-path').text()

  expect(asPath).toBe(expectedAsPath)
}

const runTests = (isServerless) => {
  if (isServerless) {
    it('should render with correct asPath with /index requested', async () => {
      await checkAsPath('/index', '/')
    })
  }

  it('should render with correct asPath with /_next/data /index requested', async () => {
    stdout = ''
    const path = `/_next/data/${buildId}/index.json`
    await renderViaHTTP(appPort, path)
    await waitFor(1000)
    const data = await renderViaHTTP(appPort, path)

    expect(JSON.parse(data).pageProps).toEqual({
      hello: 'world',
    })

    await check(() => stdout, /asPath/)
    const asPath = stdout.split('asPath: ').pop().split('\n').shift()
    expect(asPath).toBe('/')
  })

  it('should render with correct asPath with / requested', async () => {
    await checkAsPath('/', '/')
  })

  it('should render with correct asPath with /another/index requested', async () => {
    await checkAsPath('/another/index', '/another/index')
  })

  it('should render with correct asPath with /_next/data /another/index requested', async () => {
    stdout = ''
    const path = `/_next/data/${buildId}/another/index.json`
    await renderViaHTTP(appPort, path)
    await waitFor(1000)
    const data = await renderViaHTTP(appPort, path)

    expect(JSON.parse(data).pageProps).toEqual({
      hello: 'world',
    })

    await check(() => stdout, /asPath/)
    const asPath = stdout.split('asPath: ').pop().split('\n').shift()
    expect(asPath).toBe('/another/index')
  })
}

describe('Revalidate asPath Normalizing', () => {
  describe.skip('raw serverless mode', () => {
    beforeAll(async () => {
      await fs.remove(join(appDir, '.next'))
      await fs.writeFile(
        nextConfigPath,
        `
          module.exports = {
            target: 'experimental-serverless-trace'
          }
        `
      )
      appPort = await findPort()
      await nextBuild(appDir)

      buildId = await fs.readFile(join(appDir, '.next/BUILD_ID'), 'utf8')

      app = await initNextServerScript(
        join(appDir, 'server.js'),
        /ready on/,
        {
          ...process.env,
          PORT: appPort,
          BUILD_ID: buildId,
        },
        /error/,
        {
          onStdout(msg) {
            stdout += msg || ''
          },
        }
      )
    })
    afterAll(async () => {
      await killApp(app)
      await fs.remove(nextConfigPath)
    })
    runTests()
  })

  describe('server mode', () => {
    beforeAll(async () => {
      await fs.remove(join(appDir, '.next'))
      appPort = await findPort()
      await nextBuild(appDir)

      buildId = await fs.readFile(join(appDir, '.next/BUILD_ID'), 'utf8')

      app = await nextStart(appDir, appPort, {
        onStdout(msg) {
          console.log('got stdout', msg)
          stdout += msg || ''
        },
      })
    })
    afterAll(() => killApp(app))
    runTests()
  })
})
