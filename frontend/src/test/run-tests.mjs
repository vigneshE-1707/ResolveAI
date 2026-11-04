import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const shimPath = path.resolve(__dirname, 'node-shims.cjs').replaceAll('\\', '/')

const env = {
  ...process.env,
  NODE_OPTIONS: `--experimental-require-module -r "${shimPath}" ${process.env.NODE_OPTIONS || ''}`.trim(),
}

const child = spawn(
  `"${process.execPath}"`,
  ['./node_modules/vitest/vitest.mjs', 'run', ...process.argv.slice(2)],
  {
    stdio: 'inherit',
    env,
    shell: true,
  }
)

child.on('exit', (code) => process.exit(code ?? 0))
