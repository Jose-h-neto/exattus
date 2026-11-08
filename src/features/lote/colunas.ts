/*
 * Definicao unica das colunas da planilha de conferencia em lote.
 * A mesma lista gera o modelo (planilha.ts) e localiza as colunas na leitura,
 * sempre pelo texto do cabecalho, nunca pela posicao.
 */

import type { TipoLinhaLote } from '@/domain/lote/tipos'

export type GrupoColuna = 'id' | 'calc' | 'conf'

export type TipoColuna = 'texto' | 'moeda' | 'inteiro' | 'horas' | 'data' | 'modalidade'

export interface ColunaLote {
  /** Chave do registro lido (independente do formulario do calculo). */
  campo: string
  cabecalho: string
  grupo: GrupoColuna
  tipo: TipoColuna
  obrigatorio?: boolean
  largura: number
  /** Explicacao exibida na nota do cabecalho e no dicionario da aba Instrucoes. */
  nota: string
  exemplo?: string
  /** Faixa permitida (inteiros). */
  minimo?: number
  maximo?: number
  /** Valor monetario que precisa ser maior que zero (salario). */
  positivo?: boolean
}

const IDENTIFICACAO: ColunaLote[] = [
  { campo: 'matricula', cabecalho: 'Matrícula', grupo: 'id', tipo: 'texto', largura: 12, nota: 'Opcional. Código do funcionário na empresa.', exemplo: '1042' },
  { campo: 'nome', cabecalho: 'Nome', grupo: 'id', tipo: 'texto', obrigatorio: true, largura: 30, nota: 'Obrigatório. Identifica o funcionário no resultado da conferência.', exemplo: 'Ana Souza' },
  { campo: 'cpf', cabecalho: 'CPF', grupo: 'id', tipo: 'texto', largura: 16, nota: 'Opcional. Só para identificar o funcionário.', exemplo: '123.456.789-00' },
]

function conferir(bruto: string): ColunaLote[] {
  return [
    { campo: 'proventosInformado', cabecalho: bruto, grupo: 'conf', tipo: 'moeda', largura: 16, nota: 'Valor que está na folha do cliente. Deixe em branco para não conferir.' },
    { campo: 'descontosInformado', cabecalho: 'Total descontos', grupo: 'conf', tipo: 'moeda', largura: 16, nota: 'Total de descontos da folha do cliente.' },
    { campo: 'inssInformado', cabecalho: 'INSS', grupo: 'conf', tipo: 'moeda', largura: 14, nota: 'INSS descontado na folha do cliente.' },
    { campo: 'irrfInformado', cabecalho: 'IRRF', grupo: 'conf', tipo: 'moeda', largura: 14, nota: 'IRRF descontado na folha do cliente.' },
    { campo: 'liquidoInformado', cabecalho: 'Líquido', grupo: 'conf', tipo: 'moeda', largura: 16, nota: 'Líquido a receber na folha do cliente.' },
  ]
}

export const COLUNAS_FOLHA: ColunaLote[] = [
  ...IDENTIFICACAO,
  { campo: 'modalidade', cabecalho: 'Modalidade', grupo: 'calc', tipo: 'modalidade', largura: 14, nota: 'Escolha na lista. Em branco = Empregado. Pró-labore usa INSS de 11% e ignora HE, comissões, DSR e adiantamento de férias.', exemplo: 'Empregado' },
  { campo: 'salario', cabecalho: 'Salário base', grupo: 'calc', tipo: 'moeda', obrigatorio: true, positivo: true, largura: 15, nota: 'Obrigatório. Salário mensal cheio (o sistema proporcionaliza pelos dias).', exemplo: 'R$ 3.200,00' },
  { campo: 'dias', cabecalho: 'Dias trabalhados', grupo: 'calc', tipo: 'inteiro', minimo: 0, maximo: 30, largura: 11, nota: 'De 0 a 30, mês comercial. Em branco = 30.', exemplo: '30' },
  { campo: 'horasExtras', cabecalho: 'Horas extras (R$)', grupo: 'calc', tipo: 'moeda', largura: 14, nota: 'Valor pronto das horas extras do mês. Use ESTA coluna OU as colunas de horas (HE 50% / HE 100%), nunca as duas.', exemplo: 'R$ 250,00' },
  { campo: 'he50', cabecalho: 'HE 50% (hh:mm)', grupo: 'calc', tipo: 'horas', largura: 12, nota: 'Quantidade de horas extras com adicional de 50%. Digite como 10:30. O sistema calcula o valor pelo valor-hora.', exemplo: '10:30' },
  { campo: 'he100', cabecalho: 'HE 100% (hh:mm)', grupo: 'calc', tipo: 'horas', largura: 12, nota: 'Quantidade de horas extras com adicional de 100%. Digite como 04:00.', exemplo: '04:00' },
  { campo: 'divisor', cabecalho: 'Divisor', grupo: 'calc', tipo: 'inteiro', minimo: 1, maximo: 400, largura: 9, nota: 'Divisor do valor-hora. Em branco = 220. Só usado com as colunas de horas.', exemplo: '220' },
  { campo: 'baseValorHora', cabecalho: 'Base valor-hora (R$)', grupo: 'calc', tipo: 'moeda', largura: 15, nota: 'Base para o valor-hora. Em branco = salário base (Súmula 264 do TST).' },
  { campo: 'comissoes', cabecalho: 'Comissões (R$)', grupo: 'calc', tipo: 'moeda', largura: 14, nota: 'Comissões do mês.' },
  { campo: 'dsr', cabecalho: 'DSR (R$)', grupo: 'calc', tipo: 'moeda', largura: 12, nota: 'DSR sobre horas extras e comissões, como está no holerite.', exemplo: 'R$ 48,00' },
  { campo: 'dependentes', cabecalho: 'Dependentes IRRF', grupo: 'calc', tipo: 'inteiro', minimo: 0, maximo: 99, largura: 12, nota: 'Número de dependentes para o IRRF. Em branco = 0.', exemplo: '1' },
  { campo: 'adiantamentoSalarial', cabecalho: 'Adiantamento salarial (R$)', grupo: 'calc', tipo: 'moeda', largura: 15, nota: 'Vale pago no mês. Descontado do líquido, depois do INSS e do IRRF.', exemplo: 'R$ 1.280,00' },
  { campo: 'adiantamentoFerias', cabecalho: 'Adiantamento de férias (R$)', grupo: 'calc', tipo: 'moeda', largura: 15, nota: 'Líquido de férias pago antes. Descontado do líquido, depois do INSS e do IRRF.' },
  { campo: 'baseInssManual', cabecalho: 'Base INSS manual (R$)', grupo: 'calc', tipo: 'moeda', largura: 15, nota: 'Só preencha se a base do INSS for diferente do total de proventos.' },
  ...conferir('Total proventos'),
]

export const COLUNAS_FERIAS: ColunaLote[] = [
  ...IDENTIFICACAO,
  { campo: 'salario', cabecalho: 'Salário base', grupo: 'calc', tipo: 'moeda', obrigatorio: true, positivo: true, largura: 15, nota: 'Obrigatório. Salário mensal.', exemplo: 'R$ 4.500,00' },
  { campo: 'medias', cabecalho: 'Médias (R$)', grupo: 'calc', tipo: 'moeda', largura: 14, nota: 'Valor TOTAL das médias para os dias de férias (não é a média mensal).', exemplo: 'R$ 600,00' },
  { campo: 'diasFerias', cabecalho: 'Dias de férias', grupo: 'calc', tipo: 'inteiro', minimo: 1, maximo: 30, largura: 11, nota: 'De 1 a 30. Em branco = 30. Férias + abono não pode passar de 30.', exemplo: '20' },
  { campo: 'diasAbono', cabecalho: 'Dias de abono', grupo: 'calc', tipo: 'inteiro', minimo: 0, maximo: 10, largura: 11, nota: 'Dias vendidos (abono pecuniário), de 0 a 10. Em branco = sem abono.', exemplo: '10' },
  { campo: 'dependentes', cabecalho: 'Dependentes IRRF', grupo: 'calc', tipo: 'inteiro', minimo: 0, maximo: 99, largura: 12, nota: 'Número de dependentes para o IRRF. Em branco = 0.', exemplo: '0' },
  { campo: 'dataInicio', cabecalho: 'Início do gozo', grupo: 'calc', tipo: 'data', obrigatorio: true, largura: 13, nota: 'Obrigatório. Primeiro dia de férias. Todo o período precisa estar em 2026.', exemplo: '06/07/2026' },
  { campo: 'dataPagamento', cabecalho: 'Data de pagamento', grupo: 'calc', tipo: 'data', largura: 13, nota: 'Em branco = 2 dias antes do início do gozo.' },
  { campo: 'inssManual', cabecalho: 'INSS manual (R$)', grupo: 'calc', tipo: 'moeda', largura: 14, nota: 'Só preencha para substituir o INSS que o sistema estima.' },
  ...conferir('Total bruto'),
]

export const COLUNAS: Record<TipoLinhaLote, ColunaLote[]> = { folha: COLUNAS_FOLHA, ferias: COLUNAS_FERIAS }

export const NOME_ABA: Record<TipoLinhaLote, string> = { folha: 'Folha', ferias: 'Férias' }

/** Campos da aba Lote, em formato de formulario (rotulo e valor ao lado). */
export interface CampoAbaLote {
  campo: 'empresa' | 'cnpj' | 'competencia' | 'descricao' | 'tolerancia'
  rotulo: string
  obrigatorio?: boolean
  ajuda: string
  tipo: 'texto' | 'moeda' | 'competencia'
}

export const CAMPOS_ABA_LOTE: CampoAbaLote[] = [
  { campo: 'empresa', rotulo: 'Empresa', obrigatorio: true, tipo: 'texto', ajuda: 'Nome da pasta no cofre de lotes.' },
  { campo: 'cnpj', rotulo: 'CNPJ', tipo: 'texto', ajuda: 'Se já existir uma pasta com este CNPJ, o lote vai para ela. Senão, o sistema oferece criar.' },
  { campo: 'competencia', rotulo: 'Competência', obrigatorio: true, tipo: 'competencia', ajuda: 'Mês de referência no formato MM/AAAA. Ex.: 06/2026' },
  { campo: 'descricao', rotulo: 'Descrição', tipo: 'texto', ajuda: 'Opcional. Ex.: Folha de junho, conferência pré-fechamento.' },
  { campo: 'tolerancia', rotulo: 'Tolerância (R$)', tipo: 'moeda', ajuda: 'Diferença aceita como "Confere". Em branco = R$ 0,00 (tem que bater no centavo).' },
]

/** Compara cabecalhos ignorando acentos, caixa, espacos e o asterisco de obrigatorio. */
export function normalizarCabecalho(texto: string): string {
  return String(texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}
