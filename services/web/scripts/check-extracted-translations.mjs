import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const webRoot = path.resolve(__dirname, '..')
const localePath = path.join(webRoot, 'locales', 'en.json')
const extractedPath = path.join(
  webRoot,
  'frontend',
  'extracted-translations.json'
)

const sourceRoots = [
  path.join(webRoot, 'frontend', 'js'),
  path.join(webRoot, 'modules'),
]

const sourceExtensions = new Set(['.js', '.jsx', '.ts', '.tsx'])
const functionKeyPattern = /\bt\(\s*(['"])([^'"]+)\1/g
const transKeyPattern =
  /<Trans\b[^>]*\bi18nKey\s*=\s*(['"])([^'"]+)\1/g

const englishTranslations = JSON.parse(fs.readFileSync(localePath, 'utf8'))
const extractedTranslations = JSON.parse(fs.readFileSync(extractedPath, 'utf8'))
const sourceKeys = new Map()

function collectFiles(directory) {
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...collectFiles(entryPath))
    } else if (sourceExtensions.has(path.extname(entry.name))) {
      files.push(entryPath)
    }
  }
  return files
}

function collectKeys(pattern, contents, filePath) {
  for (const match of contents.matchAll(pattern)) {
    const key = match[2]
    if (Object.hasOwn(englishTranslations, key)) {
      sourceKeys.set(key, filePath)
    }
  }
}

for (const sourceRoot of sourceRoots) {
  for (const filePath of collectFiles(sourceRoot)) {
    const relativePath = path.relative(webRoot, filePath)
    const contents = fs.readFileSync(filePath, 'utf8')
    collectKeys(functionKeyPattern, contents, relativePath)
    collectKeys(transKeyPattern, contents, relativePath)
  }
}

const missingKeys = [...sourceKeys.keys()]
  .filter(key => !Object.hasOwn(extractedTranslations, key))
  .sort()

if (missingKeys.length > 0) {
  console.error('Missing keys in frontend/extracted-translations.json:')
  for (const key of missingKeys) {
    console.error(`- ${key} (${sourceKeys.get(key)})`)
  }
  process.exitCode = 1
}
