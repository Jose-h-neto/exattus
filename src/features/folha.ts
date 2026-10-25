import { reactive } from 'vue'

import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaFolha } from '@/domain/folha'
import type { Modalidade } from '@/domain/inss'

export interface FormularioFolha {
  referencia: string
  modalidade: Modalidade
  salario: string
  dias: string
  dependentes: string
  baseInssManual: string
  inssInformado: string
  irrfInformado: string
}

export type ErrosFolha = Partial<Record<keyof FormularioFolha, string>>

export function formularioFolhaPadrao(): FormularioFolha {
  return {
    referencia: '',
    modalidade: 'empregado',
    salario: '',
    dias: '30',
    dependentes: '0',
    baseInssManual: '',
    inssInformado: '',
    irrfInformado: '',
  }
}

/** Estado mantido entre trocas de pagina, para nao perder o que foi digitado. */
export const formularioFolha = reactive<FormularioFolha>(formularioFolhaPadrao())

function valorOpcional(texto: string, erros: ErrosFolha, campo: keyof FormularioFolha, mensagem: string) {
  const valor = paraCentavos(texto)

  if (valor !== null && Number.isNaN(valor)) {
    erros[campo] = mensagem
  }

  return valor === null || Number.isNaN(valor) ? null : valor
}

export function interpretarFolha(formulario: FormularioFolha) {
  const erros: ErrosFolha = {}
  const salario = paraCentavos(formulario.salario)
  const dias = paraInteiro(formulario.dias, 0, 30)
  const dependentes = paraInteiro(formulario.dependentes, 0, 99)

  if (salario !== null && (Number.isNaN(salario) || salario <= 0)) {
    erros.salario = 'Informe um salário bruto maior que zero.'
  }

  if (dias === null || Number.isNaN(dias)) {
    erros.dias = 'Informe de 0 a 30 dias.'
  }

  if (dependentes === null || Number.isNaN(dependentes)) {
    erros.dependentes = 'Informe de 0 a 99 dependentes.'
  }

  const baseInssManual = valorOpcional(formulario.baseInssManual, erros, 'baseInssManual', 'Informe uma base válida.')
  const inssInformado = valorOpcional(formulario.inssInformado, erros, 'inssInformado', 'Informe um valor válido.')
  const irrfInformado = valorOpcional(formulario.irrfInformado, erros, 'irrfInformado', 'Informe um valor válido.')

  const vazio = salario === null
  const valido = !vazio && Object.keys(erros).length === 0

  const entrada: EntradaFolha | null = valido
    ? {
        modalidade: formulario.modalidade,
        salario: salario as number,
        dias: dias as number,
        dependentes: dependentes as number,
        baseInssManual,
        inssInformado,
        irrfInformado,
      }
    : null

  return { entrada, erros, vazio }
}
