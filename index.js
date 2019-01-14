/* eslint no-console: ["error", { allow: ["log", "time", "timeEnd"] }] */
const glob = require('@now/build-utils/fs/glob.js')
const { createLambda } = require('@now/build-utils/lambda.js')
const fetch = require('node-fetch')
const download = require('@now/build-utils/fs/download.js')
const getWritableDirectory = require('@now/build-utils/fs/get-writable-directory.js')
const { getFiles, phpSpawn } = require('php-bridge-extra')
const path = require('path')
const rename = require('@now/build-utils/fs/rename.js')
const fs = require('fs')

exports.config = {
  maxLambdaSize: '10mb'
}

async function downloadFiles (files, entrypoint, workPath) {
  console.log('Downloading files...')
  const downloadedFiles = await download(files, workPath)
  // Get downloaded path of the entrypoint.
  const entryPath = downloadedFiles[entrypoint].fsPath
  return { files: downloadedFiles, entryPath }
}

function saveFiles (workPath) {
  console.log('Saving files...')
  return glob('**', workPath)
}

async function downloadFileFromUrl (source, destination, mode = 0o644) {
  const res = await fetch(source)

  if (!res.ok) {
    throw new Error(
      `Failed to download ${source}. Status code is ${res.status}`
    )
  }

  return new Promise((resolve, reject) => {
    const fileStream = fs.createWriteStream(destination, { mode })
    res.body.pipe(fileStream)
    res.body.on('error', err => {
      reject(err)
    })
    fileStream.on('finish', () => {
      console.log(`Downloaded file at: ${destination}`)
      resolve(destination)
    })
  })
}

async function downloadComposer ({ version, destination }) {
  const url = `https://getcomposer.org/download/${version}/composer.phar`
  console.log(`Downloading Composer via url: ${url}`)
  const composerPath = await downloadFileFromUrl(
    url,
    path.join(destination, 'composer'),
    0o755
  )
  return composerPath
}

function stringToRegex (inputstring) {
  const regParts = inputstring.match(/^\/(.*?)\/([gim]*)$/)
  return regParts
    ? new RegExp(regParts[1], regParts[2])
    : new RegExp(inputstring)
}

const staticRegexpsDefault = [
  '/.css$/',
  '/.gif$/',
  '/.ico$/',
  '/.js$/',
  '/.jpg$/',
  '/.png$/',
  '/.svg$/',
  '/.woff$/',
  '/.woff2$/'
]

const removeDocumentRoot = ({ entrypoint, documentRoot }) =>
  entrypoint
    .split('/')
    .filter(
      entryDir => !documentRoot.split('/').some(rootDir => rootDir === entryDir)
    )
    .join('/')

exports.build = async ({
  files,
  entrypoint,
  workPath,
  config: {
    composerVersion = '1.8.0',
    composerJson = 'composer.json',
    documentRoot = '',
    staticRegexps = staticRegexpsDefault
  }
}) => {
  let buildedFiles = files
  // Install dependencies if compose.json exist.
  if (buildedFiles[composerJson]) {
    // Download all the files to the workPath.
    await downloadFiles(files, entrypoint, workPath)

    // Download composer executable.
    const writableDir = await getWritableDirectory()
    const composerPath = await downloadComposer({
      version: composerVersion,
      destination: writableDir
    })

    const composerWorkpath = path.resolve(workPath, path.dirname(composerJson))

    console.time('🕑 Installed hirak/prestissimo in')
    await phpSpawn({
      args: [
        composerPath,
        'global',
        'require',
        'hirak/prestissimo',
        '--prefer-dist'
      ],
      workPath: composerWorkpath
    })
    console.timeEnd('🕑 Installed hirak/prestissimo in')

    console.log('Installing Composer dependencies...')
    console.time('🕑 Dependencies successfully installed in')
    await phpSpawn({
      args: [
        composerPath,
        'install',
        '--no-dev',
        '--prefer-dist',
        '--optimize-autoloader'
      ],
      workPath: composerWorkpath
    })
    console.timeEnd('🕑 Dependencies successfully installed in')

    console.time('🕑 Saved files in')
    buildedFiles = await saveFiles(workPath)
    console.timeEnd('🕑 Saved files in')
  }

  // Expose static files.
  let staticFiles = {}
  // eslint-disable-next-line no-restricted-syntax
  for (const [k, v] of Object.entries(buildedFiles)) {
    if (staticRegexps.some(r => stringToRegex(r).exec(k))) {
      staticFiles[k] = v
    }
  }
  staticFiles = rename(staticFiles, name =>
    removeDocumentRoot({ entrypoint: name, documentRoot })
  )

  // move all code to 'user' subdirectory
  const userFiles = rename(buildedFiles, name => path.join('user', name))
  // Get files to run the php-cgi.
  const bridgeFiles = await getFiles({ documentRoot })
  // Remove unnecessary php-cli.
  delete bridgeFiles['native/php']

  // Create php lambda.
  const lambda = await createLambda({
    files: { ...userFiles, ...bridgeFiles },
    handler: 'launcher.launcher',
    runtime: 'nodejs8.10'
  })

  // Prepare entrypoint.
  const phpEntry = removeDocumentRoot({ entrypoint, documentRoot })

  return {
    ...staticFiles,
    ...{ [phpEntry]: lambda }
  }
}
