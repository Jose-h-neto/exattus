import { describe, expect, it } from 'vitest'

import { avisoViradaDeAno, calcularFerias, type ResultadoFerias } from '@/domain/ferias'
import { calcularInss } from '@/domain/inss'
import { calcularIrrf } from '@/domain/irrf'
import { IRRF_2026, TABELA_INSS_2026, VERSOES_TABELAS, type TabelaInss, type VersaoTabelas } from '@/domain/parametros'
import { formularioFeriasPadrao, interpretarFerias, type FormularioFerias } from '@/features/ferias'

/** Monta a entrada pelo mesmo caminho da tela (formulario -> validacao). */
function entrada(campos: Partial<FormularioFerias>) {
  const leitura = interpretarFerias({ ...formularioFeriasPadrao(), pagamentoAutomatico: false, ...campos })

  expect(leitura.erros).toEqual({})
  expect(leitura.pendentes).toEqual([])

  return leitura.entrada!
}

function resumo(resultado: ResultadoFerias) {
  return {
    totalBruto: resultado.totalBruto,
    competencias: resultado.competencias.map((item) => [item.chave, item.dias, item.base, item.inss.total]),
    inssEstimado: resultado.inssEstimado,
    irrf: resultado.irrf.escolhida.irrf,
    liquido: resultado.liquido,
    fgts: resultado.fgts.valor,
  }
}

describe('férias dentro do mesmo ano (comportamento anterior preservado)', () => {
  // Valores gerados pela versão anterior do cálculo (antes da divisão por ano), em centavos.
  const casos = [
    {
      nome: '30 dias em um único mês, com médias',
      campos: { salario: '4500', medias: '600', diasFerias: '30', dataInicio: '2026-07-01', dataPagamento: '2026-06-29' },
      esperado: {
        totalBruto: 680000,
        competencias: [['2026-07', 30, 680000, 75352]],
        inssEstimado: 75352,
        irrf: 68082,
        liquido: 536566,
        fgts: 54400,
      },
    },
    {
      nome: '20 dias em dois meses, com abono e dependente',
      campos: {
        salario: '3200',
        diasFerias: '20',
        dataInicio: '2026-07-20',
        dataPagamento: '2026-07-18',
        dependentes: '1',
        possuiAbono: true,
        diasAbono: '10',
      },
      esperado: {
        totalBruto: 426667,
        competencias: [
          ['2026-07', 12, 170667, 12929],
          ['2026-08', 8, 113777, 8533],
        ],
        inssEstimado: 21462,
        irrf: 0,
        liquido: 405205,
        fgts: 22756,
      },
    },
    {
      nome: 'novembro e dezembro, salário alto',
      campos: { salario: '9800', medias: '1250,40', diasFerias: '15', dataInicio: '2026-11-24', dataPagamento: '2026-11-22', dependentes: '2' },
      esperado: {
        totalBruto: 820053,
        competencias: [
          ['2026-11', 7, 382692, 34784],
          ['2026-12', 8, 437361, 41383],
        ],
        inssEstimado: 76167,
        irrf: 103268,
        liquido: 640618,
        fgts: 65604,
      },
    },
  ]

  for (const caso of casos) {
    it(caso.nome, () => {
      const resultado = calcularFerias(entrada(caso.campos), { inss: TABELA_INSS_2026, irrf: IRRF_2026 })

      expect(resumo(resultado)).toEqual(caso.esperado)
      expect(resultado.inssProvisorio).toBe(false)
      expect(resultado.competencias.every((item) => item.anoTabela === 2026 && !item.provisoria)).toBe(true)
      expect(resultado.anoTabelaIrrf).toBe(2026)
      expect(avisoViradaDeAno(resultado)).toBeNull()
    })
  }

  it('sem opções usa as tabelas oficiais (mesmo resultado)', () => {
    const dados = entrada(casos[0]!.campos)

    expect(resumo(calcularFerias(dados))).toEqual(resumo(calcularFerias(dados, { inss: TABELA_INSS_2026, irrf: IRRF_2026 })))
  })

  it('a tabela de INSS editada em Parâmetros continua valendo', () => {
    const editada: TabelaInss = {
      ...TABELA_INSS_2026,
      faixas: TABELA_INSS_2026.faixas.map((faixa) => ({ ...faixa, aliquota: faixa.aliquota + 100, valorFixo: null })),
    }
    const resultado = calcularFerias(entrada(casos[0]!.campos), { inss: editada })
    const competencia = resultado.competencias[0]!

    expect(competencia.inss.total).toBe(calcularInss(competencia.base, editada).total)
    expect(competencia.inss.total).not.toBe(75352)
  })
})

describe('férias atravessando o ano', () => {
  // 22/12/2026 + 15 dias: dezembro/2026 = 10 dias, janeiro/2027 = 5 dias.
  const campos = { salario: '4500', diasFerias: '15', dataInicio: '2026-12-22', dataPagamento: '2026-12-20' }

  it('não bloqueia mais o cálculo; o início fora de 2026 continua bloqueado', () => {
    expect(interpretarFerias({ ...formularioFeriasPadrao(), ...campos, pagamentoAutomatico: false }).erros).toEqual({})

    const inicio2027 = interpretarFerias({ ...formularioFeriasPadrao(), ...campos, dataInicio: '2027-01-04', pagamentoAutomatico: false })

    expect(inicio2027.erros.dataInicio).toBeDefined()
  })

  it('sem tabela de 2027: usa a de 2026 em janeiro e marca como provisório', () => {
    const resultado = calcularFerias(entrada(campos))
    const [dezembro, janeiro] = resultado.competencias

    expect(resultado.competencias.map((item) => [item.chave, item.dias])).toEqual([
      ['2026-12', 10],
      ['2027-01', 5],
    ])
    expect(dezembro!.base + janeiro!.base).toBe(resultado.tributavel)

    expect(dezembro).toMatchObject({ anoTabela: 2026, provisoria: false })
    expect(janeiro).toMatchObject({ anoTabela: 2026, provisoria: true })
    expect(janeiro!.inss.total).toBe(calcularInss(janeiro!.base, TABELA_INSS_2026).total)
    expect(resultado.inssProvisorio).toBe(true)
    expect(resultado.inssEstimado).toBe(dezembro!.inss.total + janeiro!.inss.total)

    // IRRF sobre o total, pela tabela do pagamento (dezembro/2026).
    expect(resultado.anoTabelaIrrf).toBe(2026)
    expect(resultado.irrf.escolhida.irrf).toBe(
      calcularIrrf({ rendimento: resultado.rendimentoIrrf, inss: resultado.inssUsado, dependentes: 0 }, { tabela: IRRF_2026 }).escolhida.irrf,
    )

    expect(avisoViradaDeAno(resultado)).toBe('5 dias caem em 2027. INSS calculado com a tabela de 2026 (provisório).')
  })

  it('com tabela de 2027 cadastrada: janeiro usa a de 2027 e não é provisório', () => {
    const inss2027: TabelaInss = {
      faixas: [
        // Tabela hipotetica: aliquotas e limites diferentes da de 2026.
        { limite: 170000, aliquota: 800, valorFixo: null },
        { limite: 305000, aliquota: 900, valorFixo: null },
        { limite: 457000, aliquota: 1200, valorFixo: null },
        { limite: 890000, aliquota: 1400, valorFixo: null },
      ],
      aliquotaProlabore: 1100,
    }
    const versoes: VersaoTabelas[] = [
      ...VERSOES_TABELAS,
      { vigencia: '2027-01', rotulo: 'Tabelas 2027', inss: inss2027, irrf: IRRF_2026 },
    ]

    const resultado = calcularFerias(entrada(campos), { versoes })
    const [dezembro, janeiro] = resultado.competencias

    expect(dezembro).toMatchObject({ anoTabela: 2026, provisoria: false })
    expect(dezembro!.inss.total).toBe(calcularInss(dezembro!.base, TABELA_INSS_2026).total)

    expect(janeiro).toMatchObject({ anoTabela: 2027, provisoria: false })
    expect(janeiro!.inss.total).toBe(calcularInss(janeiro!.base, inss2027).total)
    expect(janeiro!.inss.total).not.toBe(calcularInss(janeiro!.base, TABELA_INSS_2026).total)

    expect(resultado.inssProvisorio).toBe(false)
    expect(resultado.anoTabelaIrrf).toBe(2026)
    expect(avisoViradaDeAno(resultado)).toBe('5 dias caem em 2027. INSS calculado com a tabela de 2027.')
  })
})
