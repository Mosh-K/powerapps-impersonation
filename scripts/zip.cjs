const archiver = require('archiver')
const { createWriteStream, readFileSync } = require('fs')

const { version } = JSON.parse(readFileSync('package.json', 'utf8'))
const output = `powerapps-impersonation-${version}.zip`

const stream = createWriteStream(output)
const archive = archiver('zip', { zlib: { level: 9 } })

archive.pipe(stream)
archive.directory('dist/', false)

stream.on('close', () => console.log(`Created ${output} (${archive.pointer()} bytes)`))
archive.on('error', err => { throw err })

archive.finalize()
