import { somarDias } from '../datas'

/*
 * Contagem de tempo para rescisao. Datas em UTC, intervalos sempre inclusivos.
 */

const DIA = 86_400_000

/** Dias corridos de `inicio` a `fim`, inclusive. */
export function diasInclusivos(inicio: Date, fim: Date): number {
  return Math.round((fim.getTime() - inicio.getTime()) / DIA) + 1
}

function ultimoDiaDoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes + 1, 0)).getUTCDate()
}

/** Soma meses mantendo o dia; em meses mais curtos usa o ultimo dia (31/01 + 1 = 28/02). */
export function somarMeses(data: Date, meses: number): Date {
  const ano = data.getUTCFullYear()
  const mes = data.getUTCMonth() + meses
  const alvoAno = ano + Math.floor(mes / 12)
  const alvoMes = ((mes % 12) + 12) % 12

  return new Date(Date.UTC(alvoAno, alvoMes, Math.min(data.getUTCDate(), ultimoDiaDoMes(alvoAno, alvoMes))))
}

export function ehUltimoDiaDoMes(data: Date): boolean {
  return data.getUTCDate() === ultimoDiaDoMes(data.getUTCFullYear(), data.getUTCMonth())
}

/** Anos completos de servico entre `inicio` e `fim` (inclusive). */
export function anosCompletos(inicio: Date, fim: Date): number {
  let anos = 0

  while (somarDias(somarMeses(inicio, 12 * (anos + 1)), -1) <= fim) {
    anos += 1
  }

  return anos
}

/**
 * Avos de um periodo (ferias proporcionais): meses completos contados a partir
 * de `inicio`; a fracao igual ou superior a 15 dias conta como mes (CLT, art. 146).
 */
export function avosDoPeriodo(inicio: Date, fim: Date, maximo = 12): number {
  if (fim < inicio) return 0

  let meses = 0

  while (meses < maximo && somarDias(somarMeses(inicio, meses + 1), -1) <= fim) {
    meses += 1
  }

  if (meses < maximo) {
    const restante = diasInclusivos(somarMeses(inicio, meses), fim)

    if (restante >= 15) meses += 1
  }

  return Math.min(meses, maximo)
}

/**
 * Avos de 13o no ano civil: meses do ano em que houve 15 dias ou mais de
 * trabalho (Lei 4.090/62, art. 1o, par. 2o).
 */
export function avosDecimoTerceiro(admissao: Date, fim: Date, ano: number): number {
  let avos = 0

  for (let mes = 0; mes < 12; mes += 1) {
    const inicioMes = new Date(Date.UTC(ano, mes, 1))
    const fimMes = new Date(Date.UTC(ano, mes, ultimoDiaDoMes(ano, mes)))
    const inicio = admissao > inicioMes ? admissao : inicioMes
    const termino = fim < fimMes ? fim : fimMes

    if (termino >= inicio && diasInclusivos(inicio, termino) >= 15) {
      avos += 1
    }
  }

  return avos
}

export interface PeriodoAquisitivo {
  numero: number
  inicio: Date
  fim: Date
  /** Fim do periodo concessivo (12 meses apos o aquisitivo). */
  fimConcessivo: Date
  completo: boolean
}

/** Periodos aquisitivos desde a admissao ate `dataBase`. */
export function periodosAquisitivos(admissao: Date, dataBase: Date): PeriodoAquisitivo[] {
  const periodos: PeriodoAquisitivo[] = []

  for (let indice = 0; indice < 100; indice += 1) {
    const inicio = somarMeses(admissao, 12 * indice)

    if (inicio > dataBase) break

    const fim = somarDias(somarMeses(admissao, 12 * (indice + 1)), -1)

    periodos.push({
      numero: indice + 1,
      inicio,
      fim,
      fimConcessivo: somarDias(somarMeses(admissao, 12 * (indice + 2)), -1),
      completo: fim <= dataBase,
    })
  }

  return periodos
}

/** Dias de ferias conforme as faltas injustificadas no periodo (CLT, art. 130). */
export function diasDeFeriasPorFaltas(faltas: number): number {
  if (faltas <= 5) return 30
  if (faltas <= 14) return 24
  if (faltas <= 23) return 18
  if (faltas <= 32) return 12
  return 0
}

/** Aviso previo proporcional (Lei 12.506/2011): 30 dias + 3 por ano completo, ate 90. */
export function diasAvisoProporcional(admissao: Date, dataAviso: Date): number {
  return Math.min(30 + 3 * anosCompletos(admissao, dataAviso), 90)
}

/** Dias de saldo de salario no mes do desligamento, em mes comercial de 30 dias. */
export function diasSaldoSalario(admissao: Date, desligamento: Date): number {
  const primeiroDia = new Date(Date.UTC(desligamento.getUTCFullYear(), desligamento.getUTCMonth(), 1))
  const inicio = admissao > primeiroDia ? admissao : primeiroDia

  if (inicio.getTime() === primeiroDia.getTime() && ehUltimoDiaDoMes(desligamento)) {
    return 30
  }

  return Math.min(diasInclusivos(inicio, desligamento), 30)
}
