const got = require('got')
const {ensureDir, writeFile} = require('fs-extra')
const {join, resolve} = require('path')
const Figma = require('figma-js')
const {FIGMA_TOKEN, FIGMA_FILE_URL} = process.env
const PQueue = require('p-queue')
const sanitize = require("sanitize-filename")
require('dotenv').config()

const options = {
  format: 'jpg',
  outputDir: './build/',
  scale: '1'
}

for(const arg of process.argv.slice(2)) {
  const [param, value] = arg.split('=')
  if(options[param]) {
    options[param] = value
  }
}

if(!FIGMA_TOKEN) {
  throw Error('Cannot find FIGMA_TOKEN in process!')
}

const client = Figma.Client({
  personalAccessToken: FIGMA_TOKEN
})

// Fail if there's no figma file key
let fileId = null
if (!fileId) {
  try {
    fileId = FIGMA_FILE_URL.match(/file\/([a-z0-9]+)\//i)[1]
  } catch (e) {
    throw Error('Cannot find FIGMA_FILE_URL key in process!')
  }
}

console.log(`Exporting ${FIGMA_FILE_URL} components`)
client.file(fileId)

  .then(({ data }) => {
    console.log('Processing response')
    const components = {}
    // const instances = {}
    var releaseNote = ''
    var version = ''
    var date = ''
    function check(c) {  
      const {id} = c

      if (c.type === 'INSTANCE' && c.name === 'Release') {
        releaseNote = c.children[0].characters

        components[id] = {
          releaseNote
        }
      } 
      if (c.type === 'INSTANCE' && c.name === 'Changelog / Release Version') {
        version = c.children[0].characters
        date = c.children[1].characters

        components[id] = {
          version,
          date
       }
      } else if (c.children) {
        // eslint-disable-next-line github/array-foreach
        c.children.forEach(check)
      }
    }

    data.document.children.forEach(check)
    if (Object.values(components).length === 0) {
      throw Error('No components found!')
    }
    console.log(`${Object.values(components).length} components found in the figma file`)
    return components
  })
  .then(components => {
    return ensureDir(join(options.outputDir))
      .then(() => writeFile(resolve(options.outputDir, 'data.json'), JSON.stringify(components), 'utf8'))
      .then(() => components)
  })
  .catch(error => {
    throw Error(`Error fetching components from Figma: ${error}`)
  })
