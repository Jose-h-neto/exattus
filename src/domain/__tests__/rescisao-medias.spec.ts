import { describe, expect, it } from 'vitest'

import { calcularRescisao, type ResultadoRescisao } from '@/domain/rescisao/calculo'
import { incidenciasPadrao, regrasPadrao, type CodigoRubrica } from '@/domain/rescisao/rubricas'
import {
  formularioRescisaoPadrao,
  interpretarRescisao,
  restaurarFormularioRescisao,
  sincronizarPeriodos,
  type FormularioRescisao,
} from '@/features/rescisao'

function calcular(campos: Partial<FormularioRescisao>, vencido = false): ResultadoRescisao {
  const form = { ...formularioRescisaoPadrao(), ...campos, pagamento: campos.desligamento ?? '', pagamentoAutomatico: false }

  sincronizarPeriodos(form)

  const ultimo = form.periodos.at(-1)

  if (vencido && ultimo) ultimo.gozado = false

  const leitura = interpretarRescisao(form)

  expect(leitura.erros).toEqual({})

  return calcularRescisao(leitura.entrada!, { incidencias: incidenciasPadrao(), regras: regrasPadrao() })
}

function valor(resultado: ResultadoRescisao, ...codigos: CodigoRubrica[]): number {
  const lista: string[] = codigos

  return resultado.proventos.filter((rubrica) => lista.includes(rubrica.codigo)).reduce((soma, rubrica) => soma + rubrica.valor, 0)
}

const FERIAS: CodigoRubrica[] = ['ferias_vencidas', 'ferias_proporcionais', 'ferias_aviso', 'medias_ferias']
const DECIMO: CodigoRubrica[] = ['decimo_proporcional', 'decimo_aviso', 'medias_decimo']

describe('rescisão: médias de férias e de 13º em linhas próprias', () => {
  // Totais (em centavos) gerados antes da separação das médias: não podem mudar.
  it('sem justa causa: separa as médias sem mudar férias, 13º, 1/3 e líquido', () => {
    const resultado = calcular(
      {
        salario: '3000',
        adicionais: '400',
        mediasFerias: '600',
        mediasDecimo: '450,55',
        mediasAviso: '300',
        admissao: '2023-03-10',
        desligamento: '2026-10-15',
        modalidade: 'sem_justa_causa',
        aviso: 'indenizado',
      },
      true,
    )

    expect(valor(resultado, ...FERIAS)).toBe(666666)
    expect(valor(resultado, ...DECIMO)).toBe(352967)
    expect(valor(resultado, 'terco_ferias')).toBe(222222)
    expect(resultado.liquido).toBe(1845259)

    // 600 de médias: 30 dias vencidos (600) + 7/12 proporcionais (350) + 1/12 sobre o aviso (50).
    expect(valor(resultado, 'medias_ferias')).toBe(100000)
    // 450,55 × 11/12 avos (10 no ano + 1 da projeção do aviso).
    expect(valor(resultado, 'medias_decimo')).toBe(41301)
    // As linhas de férias e 13º ficam só com salário + adicionais (3.400).
    expect(valor(resultado, 'ferias_vencidas')).toBe(340000)
    expect(valor(resultado, 'decimo_proporcional')).toBe(283333)
  })

  it('o 1/3 inclui as médias de férias', () => {
    const resultado = calcular(
      { salario: '5200', mediasFerias: '1234,56', mediasDecimo: '987,65', admissao: '2024-08-01', desligamento: '2026-09-20', modalidade: 'pedido_demissao', aviso: 'trabalhado' },
    )

    expect(valor(resultado, 'medias_ferias')).toBeGreaterThan(0)
    expect(valor(resultado, 'terco_ferias')).toBe(Math.floor((valor(resultado, ...FERIAS) + 1) / 3))
    expect(valor(resultado, 'terco_ferias')).toBe(250233)
    expect(resultado.liquido).toBe(1736089)
  })

  it('sem médias: as linhas continuam as mesmas de antes', () => {
    const resultado = calcular({ salario: '2100', admissao: '2025-01-15', desligamento: '2026-06-30', modalidade: 'acordo', aviso: 'indenizado' })

    expect(resultado.proventos.map((rubrica) => `${rubrica.codigo}=${rubrica.valor}`)).toEqual([
      'aviso_indenizado=115500',
      'saldo_salario=210000',
      'decimo_proporcional=105000',
      'decimo_aviso=17500',
      'ferias_proporcionais=105000',
      'ferias_vencidas=210000',
      'terco_ferias=105000',
    ])
    expect(resultado.liquido).toBe(842343)
  })

  it('conferência salva no modo "Única" leva a média para as três verbas', () => {
    const antiga = { salario: '3000', mediasModo: 'unica', mediaUnica: '500', mediasFerias: '', mediasDecimo: '999', mediasAviso: '' }

    expect(restaurarFormularioRescisao(antiga)).toMatchObject({ mediasFerias: '500', mediasDecimo: '500', mediasAviso: '500' })
    expect(restaurarFormularioRescisao(antiga)).not.toHaveProperty('mediaUnica')
    expect(restaurarFormularioRescisao({ medias: '120' })).toMatchObject({ mediasFerias: '120', mediasDecimo: '120', mediasAviso: '120' })
  })
})
