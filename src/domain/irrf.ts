import { dividirArredondando, formatarMoeda } from './dinheiro'
import { IRRF_2026, type FaixaIrrf, type TabelaIrrf } from './parametros'

export type ModeloIrrf = 'legal' | 'simplificado'

export type RegraReducao = 'isencao' | 'transicao' | 'acima' | 'nao_aplicada'

export interface ReducaoIrrf {
  regra: RegraReducao
  /** Reducao pela formula legal, antes do limite do imposto. */
  calculada: number
  /** Reducao efetivamente aplicada (nunca maior que o imposto). */
  valor: number
}

export interface OpcaoIrrf {
  modelo: ModeloIrrf
  nome: string
  deducoes: number
  base: number
  faixaIndice: number
  faixa: FaixaIrrf
  impostoBruto: number
  reducao: ReducaoIrrf
  irrf: number
}

export interface ResultadoIrrf {
  rendimento: number
  inss: number
  dependentes: number
  deducaoDependentes: number
  tabela: TabelaIrrf
  legal: OpcaoIrrf
  simplificado: OpcaoIrrf
  /** Falso quando o desconto simplificado nao pode ser usado (ex.: parametro do 13o). */
  simplificadoPermitido: boolean
  escolhida: OpcaoIrrf
}

export interface EntradaIrrf {
  /** Rendimento tributavel bruto (salario, ferias + 1/3...). */
  rendimento: number
  inss: number
  dependentes: number
}

export interface OpcoesIrrf {
  /** Tabela da competencia; padrao: vigente. */
  tabela?: TabelaIrrf
  /** Permite comparar com o desconto simplificado (padrao: sim). */
  simplificado?: boolean
  /** Aplica a reducao da Lei n. 15.270/2025 (padrao: sim). */
  reducao?: boolean
}

function calcularImposto(base: number, tabela: TabelaIrrf) {
  const faixas = tabela.faixas
  const faixaIndice = Math.max(faixas.findIndex((item) => base <= item.limite), 0)
  const faixa = faixas[faixaIndice] ?? faixas[0]!

  return {
    faixaIndice,
    faixa,
    impostoBruto: Math.max(0, dividirArredondando(base * faixa.aliquota, 10000) - faixa.deducao),
  }
}

export function calcularReducao(
  rendimento: number,
  imposto: number,
  tabela: TabelaIrrf = IRRF_2026,
  aplicar = true,
): ReducaoIrrf {
  const regra = tabela.reducao

  if (!aplicar || !regra) {
    return { regra: 'nao_aplicada', calculada: 0, valor: 0 }
  }

  if (rendimento <= regra.limiteIsencao) {
    return {
      regra: 'isencao',
      calculada: regra.reducaoMaxima,
      valor: Math.min(imposto, regra.reducaoMaxima),
    }
  }

  if (rendimento <= regra.limiteTransicao) {
    const calculada = Math.max(
      0,
      regra.parcelaFixa - dividirArredondando(rendimento * regra.coeficiente, regra.divisor),
    )

    return { regra: 'transicao', calculada, valor: Math.min(imposto, calculada) }
  }

  return { regra: 'acima', calculada: 0, valor: 0 }
}

function calcularOpcao(
  modelo: ModeloIrrf,
  deducoes: number,
  rendimento: number,
  tabela: TabelaIrrf,
  aplicarReducao: boolean,
): OpcaoIrrf {
  const base = Math.max(0, rendimento - deducoes)
  const imposto = calcularImposto(base, tabela)
  const reducao = calcularReducao(rendimento, imposto.impostoBruto, tabela, aplicarReducao)

  return {
    modelo,
    nome: modelo === 'legal' ? 'Deduções legais' : 'Desconto simplificado',
    deducoes,
    base,
    ...imposto,
    reducao,
    irrf: Math.max(0, imposto.impostoBruto - reducao.valor),
  }
}

/**
 * Calcula o IRRF pelas deducoes legais e pelo desconto simplificado e adota o
 * menor imposto. Em caso de empate, prevalece a menor base de calculo.
 */
export function calcularIrrf(
  { rendimento, inss, dependentes }: EntradaIrrf,
  opcoes: OpcoesIrrf = {},
): ResultadoIrrf {
  const tabela = opcoes.tabela ?? IRRF_2026
  const aplicarReducao = opcoes.reducao ?? true
  const simplificadoPermitido = opcoes.simplificado ?? true

  const deducaoDependentes = dependentes * tabela.dependente
  const legal = calcularOpcao('legal', inss + deducaoDependentes, rendimento, tabela, aplicarReducao)
  const simplificado = calcularOpcao('simplificado', tabela.simplificado, rendimento, tabela, aplicarReducao)

  const usaSimplificado =
    simplificadoPermitido &&
    (simplificado.irrf < legal.irrf || (simplificado.irrf === legal.irrf && simplificado.base < legal.base))

  return {
    rendimento,
    inss,
    dependentes,
    deducaoDependentes,
    tabela,
    legal,
    simplificado,
    simplificadoPermitido,
    escolhida: usaSimplificado ? simplificado : legal,
  }
}

export function descreverFaixaIrrf(indice: number, tabela: TabelaIrrf = IRRF_2026): string {
  const faixas = tabela.faixas
  const faixa = faixas[indice]
  const anterior = faixas[indice - 1]

  if (!faixa) {
    return '-'
  }

  if (!anterior) {
    return `Até ${formatarMoeda(faixa.limite)}`
  }

  if (!Number.isFinite(faixa.limite)) {
    return `Acima de ${formatarMoeda(anterior.limite)}`
  }

  return `De ${formatarMoeda(anterior.limite + 1)} a ${formatarMoeda(faixa.limite)}`
}
