/*
 * Modalidades de desligamento e os direitos de cada uma.
 * Fontes: CLT arts. 477 a 487, 484-A; Lei 8.036/90, art. 18; Lei 4.090/62;
 * Sumulas TST 14, 171, 261 e 305.
 */

export type TipoContrato = 'indeterminado' | 'experiencia' | 'determinado'

export type CodigoModalidade =
  | 'sem_justa_causa'
  | 'pedido_demissao'
  | 'justa_causa'
  | 'acordo'
  | 'rescisao_indireta'
  | 'culpa_reciproca'
  | 'falecimento'
  | 'termino_contrato'
  | 'antecipacao_empregador'
  | 'antecipacao_empregado'

/**
 * Como o aviso previo se aplica:
 * - empregador: dado pelo empregador (indenizado ou trabalhado), proporcional a Lei 12.506;
 * - empregado: dado pelo empregado (trabalhado, dispensado ou nao cumprido), 30 dias;
 * - metade: acordo (art. 484-A), indenizado pela metade;
 * - culpa: culpa reciproca (Sumula 14), 50% do aviso;
 * - indenizado: sempre indenizado (rescisao indireta);
 * - nenhum: sem aviso.
 */
export type RegraAviso = 'empregador' | 'empregado' | 'metade' | 'culpa' | 'indenizado' | 'nenhum'

export interface Modalidade {
  codigo: CodigoModalidade
  rotulo: string
  fundamento: string
  descricao: string
  contratos: TipoContrato[]
  aviso: RegraAviso
  /** Fator do 13o proporcional (1, 0,5 ou 0). */
  decimo: number
  /** Fator das ferias proporcionais (1, 0,5 ou 0). */
  feriasProporcionais: number
  /** Multa do FGTS em pontos-base (4000 = 40%). */
  multaFgts: number
  indenizacao479: boolean
  indenizacao480: boolean
  saqueFgts: string
  seguroDesemprego: boolean
}

const TODOS: TipoContrato[] = ['indeterminado', 'experiencia', 'determinado']
const PRAZO: TipoContrato[] = ['experiencia', 'determinado']

export const MODALIDADES: readonly Modalidade[] = [
  {
    codigo: 'sem_justa_causa',
    rotulo: 'Dispensa sem justa causa',
    fundamento: 'CLT, art. 477 e 487',
    descricao: 'Iniciativa do empregador. Aviso prévio proporcional, 13º e férias proporcionais, multa de 40% do FGTS.',
    contratos: ['indeterminado'],
    aviso: 'empregador',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 4000,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Integral',
    seguroDesemprego: true,
  },
  {
    codigo: 'pedido_demissao',
    rotulo: 'Pedido de demissão',
    fundamento: 'CLT, art. 487, § 2º; Súmula 261 TST',
    descricao: 'Iniciativa do empregado. Aviso de 30 dias a cumprir; se não cumprido, pode ser descontado. Sem multa do FGTS.',
    contratos: ['indeterminado'],
    aviso: 'empregado',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 0,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Não',
    seguroDesemprego: false,
  },
  {
    codigo: 'justa_causa',
    rotulo: 'Dispensa por justa causa',
    fundamento: 'CLT, art. 482; Súmula 171 TST',
    descricao: 'Devidos apenas saldo de salário e férias vencidas com 1/3. Sem aviso, 13º e férias proporcionais.',
    contratos: TODOS,
    aviso: 'nenhum',
    decimo: 0,
    feriasProporcionais: 0,
    multaFgts: 0,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Não',
    seguroDesemprego: false,
  },
  {
    codigo: 'acordo',
    rotulo: 'Acordo entre as partes',
    fundamento: 'CLT, art. 484-A',
    descricao: 'Aviso indenizado pela metade, multa de 20% do FGTS e saque de até 80% do saldo. Demais verbas integrais.',
    contratos: ['indeterminado'],
    aviso: 'metade',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 2000,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Até 80%',
    seguroDesemprego: false,
  },
  {
    codigo: 'rescisao_indireta',
    rotulo: 'Rescisão indireta',
    fundamento: 'CLT, art. 483',
    descricao: 'Falta grave do empregador. Mesmos direitos da dispensa sem justa causa, com aviso indenizado.',
    contratos: ['indeterminado'],
    aviso: 'indenizado',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 4000,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Integral',
    seguroDesemprego: true,
  },
  {
    codigo: 'culpa_reciproca',
    rotulo: 'Culpa recíproca',
    fundamento: 'CLT, art. 484; Súmula 14 TST',
    descricao: 'Metade do aviso prévio, do 13º e das férias proporcionais; multa de 20% do FGTS.',
    contratos: ['indeterminado'],
    aviso: 'culpa',
    decimo: 0.5,
    feriasProporcionais: 0.5,
    multaFgts: 2000,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Integral',
    seguroDesemprego: false,
  },
  {
    codigo: 'falecimento',
    rotulo: 'Falecimento do empregado',
    fundamento: 'Lei 6.858/80',
    descricao: 'Saldo de salário, 13º e férias proporcionais e vencidas com 1/3, pagos aos dependentes. Sem aviso e sem multa.',
    contratos: TODOS,
    aviso: 'nenhum',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 0,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Dependentes ou sucessores',
    seguroDesemprego: false,
  },
  {
    codigo: 'termino_contrato',
    rotulo: 'Término do contrato a prazo',
    fundamento: 'CLT, arts. 443 e 445',
    descricao: 'Fim do contrato de experiência ou por prazo determinado na data prevista. Sem aviso e sem multa do FGTS.',
    contratos: PRAZO,
    aviso: 'nenhum',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 0,
    indenizacao479: false,
    indenizacao480: false,
    saqueFgts: 'Integral',
    seguroDesemprego: false,
  },
  {
    codigo: 'antecipacao_empregador',
    rotulo: 'Antecipação pelo empregador',
    fundamento: 'CLT, arts. 479 e 481',
    descricao: 'Rescisão antecipada de contrato a prazo pelo empregador: indenização de metade da remuneração até o termo e multa de 40% do FGTS.',
    contratos: PRAZO,
    aviso: 'nenhum',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 4000,
    indenizacao479: true,
    indenizacao480: false,
    saqueFgts: 'Integral',
    seguroDesemprego: true,
  },
  {
    codigo: 'antecipacao_empregado',
    rotulo: 'Antecipação pelo empregado',
    fundamento: 'CLT, arts. 480 e 481',
    descricao: 'Rescisão antecipada de contrato a prazo pelo empregado: ele indeniza os prejuízos, limitado ao valor do art. 479.',
    contratos: PRAZO,
    aviso: 'nenhum',
    decimo: 1,
    feriasProporcionais: 1,
    multaFgts: 0,
    indenizacao479: false,
    indenizacao480: true,
    saqueFgts: 'Não',
    seguroDesemprego: false,
  },
]

export function obterModalidade(codigo: CodigoModalidade): Modalidade {
  return MODALIDADES.find((item) => item.codigo === codigo) ?? MODALIDADES[0]!
}

/**
 * Com clausula assecuratoria (art. 481), a antecipacao do contrato a prazo segue
 * as regras do contrato por prazo indeterminado: aviso previo em vez das
 * indenizacoes dos arts. 479/480.
 */
export function regraEfetiva(modalidade: Modalidade, clausulaAssecuratoria: boolean): Modalidade {
  if (!clausulaAssecuratoria) return modalidade

  if (modalidade.codigo === 'antecipacao_empregador') {
    return { ...modalidade, aviso: 'empregador', indenizacao479: false }
  }

  if (modalidade.codigo === 'antecipacao_empregado') {
    return { ...modalidade, aviso: 'empregado', indenizacao480: false }
  }

  return modalidade
}

export const ROTULOS_CONTRATO: Record<TipoContrato, string> = {
  indeterminado: 'Prazo indeterminado',
  experiencia: 'Experiência',
  determinado: 'Prazo determinado',
}

/** Rotulos curtos para seletores compactos. */
export const ROTULOS_CONTRATO_CURTOS: Record<TipoContrato, string> = {
  indeterminado: 'Indeterminado',
  experiencia: 'Experiência',
  determinado: 'Determinado',
}
