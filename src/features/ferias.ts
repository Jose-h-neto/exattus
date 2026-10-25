import { reactive } from 'vue'

import { lerData, paraInputData, somarDias } from '@/domain/datas'
import { paraCentavos, paraInteiro } from '@/domain/dinheiro'
import type { EntradaFerias } from '@/domain/ferias'
import { ANO_VIGENCIA } from '@/domain/parametros'

export interface FormularioFerias {
  referencia: string
  salario: string
  medias: string
  diasFerias: string
  dependentes: string
  dataInicio: string
  dataPagamento: string
  /** Enquanto verdadeiro, o pagamento acompanha o inicio (2 dias antes). */
  pagamentoAutomatico: boolean
  possuiAbono: boolean
  diasAbono: string
  inssManual: string
}

export type ErrosFerias = Partial<Record<keyof FormularioFerias, string>>

export function formularioFeriasPadrao(): FormularioFerias {
  return {
    referencia: '',
    salario: '',
    medias: '',
    diasFerias: '30',
    dependentes: '0',
    dataInicio: '',
    dataPagamento: '',
    pagamentoAutomatico: true,
    possuiAbono: false,
    diasAbono: '10',
    inssManual: '',
  }
}

export const formularioFerias = reactive<FormularioFerias>(formularioFeriasPadrao())

/** Sugere o pagamento dois dias antes do inicio do gozo. */
export function sugerirPagamento(formulario: FormularioFerias) {
  const inicio = lerData(formulario.dataInicio)

  if (inicio && (formulario.pagamentoAutomatico || !formulario.dataPagamento)) {
    formulario.dataPagamento = paraInputData(somarDias(inicio, -2))
  }
}

/** Ao marcar o abono, sugere 10 dias vendidos e limita o gozo a 20 dias. */
export function aoAlternarAbono(formulario: FormularioFerias) {
  if (!formulario.possuiAbono) {
    return
  }

  formulario.diasAbono = '10'

  if (Number(formulario.diasFerias) > 20) {
    formulario.diasFerias = '20'
  }
}

export function interpretarFerias(formulario: FormularioFerias) {
  const erros: ErrosFerias = {}
  const pendentes: string[] = []

  const salario = paraCentavos(formulario.salario)
  const medias = paraCentavos(formulario.medias)
  const diasFerias = paraInteiro(formulario.diasFerias, 1, 30)
  const dependentes = paraInteiro(formulario.dependentes, 0, 99)
  const diasAbono = formulario.possuiAbono ? paraInteiro(formulario.diasAbono, 1, 10) : 0
  const inssManual = paraCentavos(formulario.inssManual)
  const inicio = lerData(formulario.dataInicio)
  const pagamento = lerData(formulario.dataPagamento)

  if (salario === null) {
    pendentes.push('Informe o salário bruto')
  } else if (Number.isNaN(salario) || salario <= 0) {
    erros.salario = 'Informe um salário bruto mensal maior que zero.'
  }

  if (medias !== null && Number.isNaN(medias)) {
    erros.medias = 'Informe um valor válido para médias e adicionais.'
  }

  if (diasFerias === null || Number.isNaN(diasFerias)) {
    erros.diasFerias = 'Os dias de férias devem estar entre 1 e 30.'
  }

  if (dependentes === null || Number.isNaN(dependentes)) {
    erros.dependentes = 'Informe de 0 a 99 dependentes.'
  }

  if (formulario.possuiAbono && (diasAbono === null || Number.isNaN(diasAbono))) {
    erros.diasAbono = 'Os dias vendidos devem estar entre 1 e 10.'
  }

  if (inssManual !== null && Number.isNaN(inssManual)) {
    erros.inssManual = 'Informe um INSS válido.'
  }

  if (!formulario.dataInicio) {
    pendentes.push('Informe o início do gozo')
  } else if (!inicio) {
    erros.dataInicio = 'Informe uma data válida.'
  }

  if (!formulario.dataPagamento) {
    pendentes.push('Informe a data do pagamento')
  } else if (!pagamento) {
    erros.dataPagamento = 'Informe uma data válida.'
  } else if (pagamento.getUTCFullYear() !== ANO_VIGENCIA) {
    erros.dataPagamento = `O pagamento deve ocorrer em ${ANO_VIGENCIA} para usar a tabela de IRRF vigente.`
  }

  const dias = Number.isInteger(diasFerias) ? (diasFerias as number) : 0
  const fim = inicio && dias > 0 ? somarDias(inicio, dias - 1) : null

  if (inicio && fim && (inicio.getUTCFullYear() !== ANO_VIGENCIA || fim.getUTCFullYear() !== ANO_VIGENCIA)) {
    erros.dataInicio = `Todo o período de gozo deve estar em ${ANO_VIGENCIA} para usar a tabela de INSS vigente.`
  }

  const abono = Number.isInteger(diasAbono) ? (diasAbono as number) : 0

  if (!erros.diasFerias && !erros.diasAbono && dias + abono > 30) {
    erros.diasAbono = 'A soma dos dias gozados e vendidos não pode ultrapassar 30.'
  }

  const valido = pendentes.length === 0 && Object.keys(erros).length === 0

  const entrada: EntradaFerias | null =
    valido && inicio && fim && pagamento
      ? {
          salario: salario as number,
          medias: medias ?? 0,
          diasFerias: dias,
          dependentes: dependentes as number,
          inicio,
          fim,
          pagamento,
          diasAbono: abono,
          inssManual,
        }
      : null

  return { entrada, erros, pendentes, fim }
}
