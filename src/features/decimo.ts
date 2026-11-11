import { reactive } from 'vue'

import type { EntradaDecimo, ParcelaDecimo } from '@/domain/decimo'
import { paraCentavos, paraInteiro } from '@/domain/dinheiro'

export interface FormularioDecimo {
  referencia: string
  parcela: ParcelaDecimo
  salario: string
  /** Media mensal das variaveis (horas extras, comissoes, adicionais). */
  medias: string
  avos: string
  dependentes: string
  /** 2a parcela: 1a parcela paga; vazio = metade do 13o calculado. */
  primeiraParcelaPaga: string
  inssInformado: string
  irrfInformado: string
}

export type ErrosDecimo = Partial<Record<keyof FormularioDecimo, string>>

/** Sugere a parcela pelo mes atual: dezembro = 2a; demais meses = 1a. */
export function parcelaSugerida(hoje = new Date()): ParcelaDecimo {
  return hoje.getMonth() === 11 ? 'segunda' : 'primeira'
}

export function formularioDecimoPadrao(): FormularioDecimo {
  return {
    referencia: '',
    parcela: parcelaSugerida(),
    salario: '',
    medias: '',
    avos: '12',
    dependentes: '0',
    primeiraParcelaPaga: '',
    inssInformado: '',
    irrfInformado: '',
  }
}

/** Estado mantido entre trocas de pagina, para nao perder o que foi digitado. */
export const formularioDecimo = reactive<FormularioDecimo>(formularioDecimoPadrao())

function valorOpcional(texto: string, erros: ErrosDecimo, campo: keyof FormularioDecimo): number | null {
  const valor = paraCentavos(texto)

  if (valor !== null && (Number.isNaN(valor) || valor < 0)) {
    erros[campo] = 'Informe um valor válido.'
    return null
  }

  return valor
}

export function interpretarDecimo(formulario: FormularioDecimo) {
  const erros: ErrosDecimo = {}
  const segunda = formulario.parcela === 'segunda'

  const salario = paraCentavos(formulario.salario)
  const avos = paraInteiro(formulario.avos, 1, 12)
  const dependentes = paraInteiro(formulario.dependentes, 0, 99)

  if (salario !== null && (Number.isNaN(salario) || salario <= 0)) {
    erros.salario = 'Informe um salário bruto maior que zero.'
  }

  if (avos === null || Number.isNaN(avos)) {
    erros.avos = 'Informe de 1 a 12 avos.'
  }

  // Dependentes so importam na 2a parcela (IRRF); na 1a o campo fica oculto.
  if (segunda && (dependentes === null || Number.isNaN(dependentes))) {
    erros.dependentes = 'Informe de 0 a 99 dependentes.'
  }

  const medias = valorOpcional(formulario.medias, erros, 'medias') ?? 0
  const primeiraParcelaPaga = segunda ? valorOpcional(formulario.primeiraParcelaPaga, erros, 'primeiraParcelaPaga') : null
  const inssInformado = segunda ? valorOpcional(formulario.inssInformado, erros, 'inssInformado') : null
  const irrfInformado = segunda ? valorOpcional(formulario.irrfInformado, erros, 'irrfInformado') : null

  const vazio = salario === null
  const valido = !vazio && Object.keys(erros).length === 0

  const entrada: EntradaDecimo | null = valido
    ? {
        parcela: formulario.parcela,
        salario: salario as number,
        medias,
        avos: avos as number,
        dependentes: segunda ? (dependentes as number) : 0,
        primeiraParcelaPaga,
        inssInformado,
        irrfInformado,
      }
    : null

  return { entrada, erros, vazio }
}
