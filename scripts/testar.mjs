/*
 * Roda o Vitest com a letra do drive em maiuscula.
 *
 * No Windows, com o projeto aberto como "c:\..." (ex.: terminal do VS Code), o
 * Vitest carrega o proprio modulo duas vezes e todo teste falha com
 * "Cannot read properties of undefined (reading 'config')". Iniciar o processo
 * ja em "C:\..." evita o problema. Argumentos extras sao repassados ao Vitest.
 */
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const maiuscula = (caminho) => caminho.replace(/^[a-z]:/, (drive) => drive.toUpperCase())

const cwd = maiuscula(process.cwd())
const vitest = maiuscula(fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url)))
const argumentos = process.argv.slice(2)

const execucao = spawnSync(process.execPath, [vitest, ...(argumentos.length ? argumentos : ['run'])], { cwd, stdio: 'inherit' })

process.exit(execucao.status ?? 1)
