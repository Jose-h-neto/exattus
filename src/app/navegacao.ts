import type { NomeIcone } from '@/components/ui/UiIcon.vue'

export interface ItemNavegacao {
  rota: string
  rotulo: string
  descricao: string
  icone: NomeIcone
}

export interface GrupoNavegacao {
  titulo: string
  itens: ItemNavegacao[]
}

/** Estrutura unica de menus: a mesma fonte alimenta a barra lateral e a trilha das paginas. */
export const NAVEGACAO: GrupoNavegacao[] = [
  {
    titulo: 'Cálculos',
    itens: [
      {
        rota: 'folha',
        rotulo: 'Folha mensal',
        descricao: 'Salário proporcional, INSS, IRRF e conferência do holerite.',
        icone: 'folha',
      },
      {
        rota: 'ferias',
        rotulo: 'Férias',
        descricao: 'Férias gozadas, 1/3, abono pecuniário, INSS por competência e IRRF.',
        icone: 'ferias',
      },
      {
        rota: 'rescisao',
        rotulo: 'Rescisão',
        descricao: 'Cálculo e conferência das verbas rescisórias, encargos e divergências com a folha de pagamento.',
        icone: 'rescisao',
      },
    ],
  },
  {
    titulo: 'Registros',
    itens: [
      {
        rota: 'conferencias',
        rotulo: 'Conferências salvas',
        descricao: 'Cálculos salvos de folha e férias, prontos para reabrir ou exportar. Ficam salvos apenas neste navegador.',
        icone: 'arquivo',
      },
    ],
  },
  {
    titulo: 'Configuração',
    itens: [
      {
        rota: 'parametros',
        rotulo: 'Tabelas e parâmetros',
        descricao: 'Tabela de contribuição do INSS, tabela do IRRF, deduções e regras de cálculo.',
        icone: 'ajustes',
      },
    ],
  },
]

export function localizarItem(rota: string) {
  for (const grupo of NAVEGACAO) {
    const item = grupo.itens.find((candidato) => candidato.rota === rota)

    if (item) {
      return { grupo, item }
    }
  }

  return null
}
