import { reactive } from 'vue'

import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaFolha } from '@/domain/folha'
import type { Modalidade } from '@/domain/inss'

export interface FormularioFolha {
  referencia: string
  modalidade: Modalidade
  salario: string
  dias: string
  horasExtras: string
  comissoes: string
  dsr: string
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
    horasExtras: '',
    comissoes: '',
    dsr: '',
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

/** Provento adicional opcional: vazio vale zero; negativo e invalido. */
function valorAdicional(texto: string, erros: ErrosFolha, campo: keyof FormularioFolha) {
  const valor = valorOpcional(texto, erros, campo, 'Informe um valor válido.')

  if (valor !== null && valor < 0) {
    erros[campo] = 'Informe um valor positivo.'
    return 0
  }

  return valor ?? 0
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

  // Horas extras, comissoes e DSR nao se aplicam ao pro-labore (os campos ficam ocultos).
  const empregado = formulario.modalidade === 'empregado'
  const horasExtras = empregado ? valorAdicional(formulario.horasExtras, erros, 'horasExtras') : 0
  const comissoes = empregado ? valorAdicional(formulario.comissoes, erros, 'comissoes') : 0
  const dsr = empregado ? valorAdicional(formulario.dsr, erros, 'dsr') : 0

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
        horasExtras,
        comissoes,
        dsr,
        dependentes: dependentes as number,
        baseInssManual,
        inssInformado,
        irrfInformado,
      }
    : null

  return { entrada, erros, vazio }
}
