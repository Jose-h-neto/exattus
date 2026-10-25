/* Datas sao tratadas em UTC para que fuso horario e horario de verao nao alterem dias. */

const dataBr = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

const dataHoraBr = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
})

const competenciaBr = new Intl.DateTimeFormat('pt-BR', {
  month: 'long',
  year: 'numeric',
  timeZone: 'UTC',
})

export function lerData(valor: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return null
  }

  const [ano = 0, mes = 0, dia = 0] = valor.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))

  const valida =
    data.getUTCFullYear() === ano &&
    data.getUTCMonth() === mes - 1 &&
    data.getUTCDate() === dia

  return valida ? data : null
}

export function somarDias(data: Date, dias: number): Date {
  const copia = new Date(data.getTime())

  copia.setUTCDate(copia.getUTCDate() + dias)

  return copia
}

export function paraInputData(data: Date): string {
  return [
    data.getUTCFullYear(),
    String(data.getUTCMonth() + 1).padStart(2, '0'),
    String(data.getUTCDate()).padStart(2, '0'),
  ].join('-')
}

/** Chave "AAAA-MM" de uma competencia. */
export function chaveMes(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, '0')}`
}

export function nomeCompetencia(chave: string): string {
  const [ano = 0, mes = 1] = chave.split('-').map(Number)
  const nome = competenciaBr.format(new Date(Date.UTC(ano, mes - 1, 1)))

  return nome.charAt(0).toUpperCase() + nome.slice(1)
}

export function formatarData(data: Date): string {
  return dataBr.format(data)
}

/** "2026-10-15" -> "15/10/2026"; vazio quando a data e invalida. */
export function isoParaBr(iso: string): string {
  const data = lerData(iso)

  return data ? formatarData(data) : ''
}

/** "15/10/2026" -> "2026-10-15"; `null` quando incompleta ou inexistente (ex.: 31/02). */
export function brParaIso(texto: string): string | null {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texto)

  if (!partes) return null

  const iso = `${partes[3]}-${partes[2]}-${partes[1]}`

  return lerData(iso) ? iso : null
}

/** Aplica a mascara dd/mm/aaaa a partir dos digitos digitados. */
export function mascararData(texto: string): string {
  const digitos = texto.replace(/\D/g, '').slice(0, 8)

  if (digitos.length <= 2) return digitos
  if (digitos.length <= 4) return `${digitos.slice(0, 2)}/${digitos.slice(2)}`

  return `${digitos.slice(0, 2)}/${digitos.slice(2, 4)}/${digitos.slice(4)}`
}

export const NOMES_MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
] as const

export function formatarDataHora(iso: string): string {
  const data = new Date(iso)

  return Number.isNaN(data.getTime()) ? '-' : dataHoraBr.format(data)
}
