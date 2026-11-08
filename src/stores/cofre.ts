import { computed, ref } from 'vue'

import { tabelaHoraAulaPadrao, type ProfessorHoraAula, type TabelaHoraAula } from '@/domain/horaAula'
import type { CabecalhoLote, Empresa, LinhaLote, Lote } from '@/domain/lote/tipos'
import { normalizarCnpj, resumirLinhas } from '@/domain/lote/tipos'
import { lerTabelaColada, montarProfessores } from '@/features/lote/colarProfessores'
import { gravarJson, lerJson } from '@/lib/armazenamento'
import { aplicar, listar, LOJAS, obter } from '@/lib/banco'

/** Marca que a instituicao pre-cadastrada ja foi criada (nao volta se o usuario excluir). */
const CHAVE_SEMENTE = 'exattus:semente-hora-aula'
const INSTITUICAO_PADRAO = 'Alvorada-Bianchi'

/*
 * Cofre de lotes: pastas por empresa, cada uma com suas conferencias em lote.
 * Empresas e cabecalhos dos lotes ficam em memoria; as linhas de cada lote so
 * sao lidas quando o lote e aberto.
 */

interface LinhasGravadas {
  loteId: string
  linhas: LinhaLote[]
}

const empresas = ref<Empresa[]>([])
const lotes = ref<CabecalhoLote[]>([])
const carregado = ref(false)
const erro = ref<string | null>(null)

let carregando: Promise<void> | null = null

function novoId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function mensagem(causa: unknown): string {
  return causa instanceof Error ? causa.message : 'Não foi possível acessar o armazenamento do navegador.'
}

function ordenarEmpresas(lista: Empresa[]): Empresa[] {
  return [...lista].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

/*
 * Dados locais: src/dados-locais/<Instituicao>.tsv (ignorado pelo git, nunca
 * publicado). Cada arquivo e uma tabela de professores no formato do "Colar do
 * Excel" e e carregado uma vez na instituicao de mesmo nome.
 */
const DADOS_LOCAIS = import.meta.glob('/src/dados-locais/*.tsv', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>
const CHAVE_DADOS_LOCAIS = 'exattus:dados-locais-aplicados'

/** Tabela criada pela primeira versao da hora-aula (5 tipos com nomes antigos): troca pela atual. */
const IDS_TABELA_ANTIGA = ['ensino-medio', 'fundamental', 'infantil', 'subs-medio', 'subs-fundamental']

function ehTabelaAntiga(tabela: TabelaHoraAula | undefined): boolean {
  return Boolean(
    tabela &&
      tabela.tipos.length === IDS_TABELA_ANTIGA.length &&
      tabela.tipos.every((tipo, indice) => tipo.id === IDS_TABELA_ANTIGA[indice]) &&
      tabela.tipos.some((tipo) => tipo.descricao === 'Substituição Ensino Médio'),
  )
}

function mesmoNome(a: string, b: string): boolean {
  return a.trim().localeCompare(b.trim(), 'pt-BR', { sensitivity: 'base' }) === 0
}

async function aplicarDadosLocais(lista: Empresa[]): Promise<Empresa[]> {
  const aplicados = lerJson(CHAVE_DADOS_LOCAIS, (valor): valor is string[] => Array.isArray(valor)) ?? []
  let resultado = lista

  for (const [caminho, texto] of Object.entries(DADOS_LOCAIS)) {
    const nome = caminho.split('/').pop()?.replace(/\.tsv$/i, '') ?? ''

    if (!nome || aplicados.includes(nome)) continue

    const atual = resultado.find((empresa) => mesmoNome(empresa.nome, nome))

    // Lista ja cadastrada pelo usuario: nao sobrescreve.
    if (atual?.professores?.length) {
      aplicados.push(nome)
      continue
    }

    const base = atual?.horaAula && !ehTabelaAntiga(atual.horaAula) ? atual.horaAula : tabelaHoraAulaPadrao()
    const colada = lerTabelaColada(texto, base)
    const { professores, tabela } = montarProfessores(colada, colada.colunas.map((coluna) => coluna.sugestao), base)

    const empresa: Empresa = {
      ...(atual ?? { id: novoId(), nome, cnpj: '', criadaEm: new Date().toISOString() }),
      horaAula: tabela,
      professores: professores.map((professor) => ({ id: novoId(), matricula: '', ...professor })),
    }

    await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
    resultado = atual ? resultado.map((item) => (item.id === empresa.id ? empresa : item)) : [...resultado, empresa]
    aplicados.push(nome)
  }

  gravarJson(CHAVE_DADOS_LOCAIS, aplicados)

  return resultado
}

/** Atualiza a tabela antiga de 5 tipos (sem professores) para as rubricas atuais. */
async function migrarTabelasAntigas(lista: Empresa[]): Promise<Empresa[]> {
  const antigas = lista.filter((empresa) => ehTabelaAntiga(empresa.horaAula) && !empresa.professores?.length)

  if (!antigas.length) return lista

  const atualizadas = antigas.map((empresa) => ({ ...empresa, horaAula: tabelaHoraAulaPadrao() }))

  await aplicar(atualizadas.map((empresa) => ({ loja: LOJAS.empresas, gravar: empresa })))

  return lista.map((empresa) => atualizadas.find((item) => item.id === empresa.id) ?? empresa)
}

/** Pre-cadastra a instituicao com a tabela de hora-aula informada pelo usuario, uma unica vez. */
async function semearInstituicao(lista: Empresa[]): Promise<Empresa[]> {
  if (lerJson(CHAVE_SEMENTE, (valor): valor is true => valor === true)) return lista

  const existe = lista.some((empresa) => empresa.nome.localeCompare(INSTITUICAO_PADRAO, 'pt-BR', { sensitivity: 'base' }) === 0)

  if (existe) {
    gravarJson(CHAVE_SEMENTE, true)
    return lista
  }

  const empresa: Empresa = {
    id: novoId(),
    nome: INSTITUICAO_PADRAO,
    cnpj: '',
    criadaEm: new Date().toISOString(),
    horaAula: tabelaHoraAulaPadrao(),
  }

  await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
  gravarJson(CHAVE_SEMENTE, true)

  return [...lista, empresa]
}

function carregar(): Promise<void> {
  carregando ??= Promise.all([listar<Empresa>(LOJAS.empresas), listar<CabecalhoLote>(LOJAS.lotes)])
    .then(async ([listaEmpresas, listaLotes]) => {
      const semeadas = await migrarTabelasAntigas(await semearInstituicao(listaEmpresas))

      empresas.value = ordenarEmpresas(await aplicarDadosLocais(semeadas))
      lotes.value = listaLotes
      erro.value = null
    })
    .catch((causa) => {
      erro.value = mensagem(causa)
      carregando = null
    })
    .finally(() => {
      carregado.value = true
    })

  return carregando
}

export function useCofre() {
  void carregar()

  return {
    empresas,
    carregado,
    erro,
    pronto: carregar,
    totalEmpresas: computed(() => empresas.value.length),
    /** Instituicoes com tabela de hora-aula cadastrada. */
    instituicoes: computed(() => empresas.value.filter((empresa) => empresa.horaAula?.tipos.length)),

    obterEmpresa(id: string): Empresa | undefined {
      return empresas.value.find((empresa) => empresa.id === id)
    },

    empresaPorCnpj(cnpj: string): Empresa | undefined {
      const digitos = normalizarCnpj(cnpj)

      return digitos ? empresas.value.find((empresa) => empresa.cnpj === digitos) : undefined
    },

    /** Lotes da empresa, do mais recente (competencia e data de importacao) para o mais antigo. */
    lotesDa(empresaId: string): CabecalhoLote[] {
      return lotes.value
        .filter((lote) => lote.empresaId === empresaId)
        .sort((a, b) => b.competencia.localeCompare(a.competencia) || b.criadoEm.localeCompare(a.criadoEm))
    },

    async criarEmpresa(dados: { nome: string; cnpj: string }): Promise<Empresa> {
      const empresa: Empresa = {
        id: novoId(),
        nome: dados.nome.trim(),
        cnpj: normalizarCnpj(dados.cnpj),
        criadaEm: new Date().toISOString(),
      }

      await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
      empresas.value = ordenarEmpresas([...empresas.value, empresa])

      return empresa
    },

    async atualizarEmpresa(id: string, dados: { nome: string; cnpj: string }) {
      const atual = empresas.value.find((empresa) => empresa.id === id)

      if (!atual) return

      const empresa: Empresa = { ...atual, nome: dados.nome.trim(), cnpj: normalizarCnpj(dados.cnpj) }

      await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
      empresas.value = ordenarEmpresas(empresas.value.map((item) => (item.id === id ? empresa : item)))
    },

    /** Grava (ou remove, com null) a tabela de hora-aula da empresa. */
    async salvarHoraAula(id: string, tabela: TabelaHoraAula | null) {
      const atual = empresas.value.find((empresa) => empresa.id === id)

      if (!atual) return

      const { horaAula: _anterior, ...resto } = atual
      const empresa: Empresa = tabela ? { ...resto, horaAula: tabela } : resto

      await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
      empresas.value = empresas.value.map((item) => (item.id === id ? empresa : item))
    },

    /**
     * Grava os professores (aulas padrao) da instituicao. Com `tabela`, grava
     * tambem a tabela de hora-aula na mesma transacao (ex.: rubricas criadas ao colar).
     */
    async salvarProfessores(id: string, professores: ProfessorHoraAula[], tabela?: TabelaHoraAula) {
      const atual = empresas.value.find((empresa) => empresa.id === id)

      if (!atual) return

      const empresa: Empresa = { ...atual, professores, ...(tabela ? { horaAula: tabela } : {}) }

      await aplicar([{ loja: LOJAS.empresas, gravar: empresa }])
      empresas.value = empresas.value.map((item) => (item.id === id ? empresa : item))
    },

    /** Exclui a pasta e todos os lotes dela. */
    async excluirEmpresa(id: string) {
      const daEmpresa = lotes.value.filter((lote) => lote.empresaId === id)

      await aplicar([
        { loja: LOJAS.empresas, excluir: id },
        ...daEmpresa.flatMap((lote) => [
          { loja: LOJAS.lotes, excluir: lote.id },
          { loja: LOJAS.linhasLote, excluir: lote.id },
        ]),
      ])

      empresas.value = empresas.value.filter((empresa) => empresa.id !== id)
      lotes.value = lotes.value.filter((lote) => lote.empresaId !== id)
    },

    async salvarLote(dados: Omit<Lote, 'id' | 'criadoEm' | 'resumo'>): Promise<CabecalhoLote> {
      const { linhas, ...resto } = dados
      const cabecalho: CabecalhoLote = {
        ...resto,
        id: novoId(),
        criadoEm: new Date().toISOString(),
        resumo: resumirLinhas(linhas),
      }

      await aplicar([
        { loja: LOJAS.lotes, gravar: cabecalho },
        { loja: LOJAS.linhasLote, gravar: { loteId: cabecalho.id, linhas } satisfies LinhasGravadas },
      ])

      lotes.value = [...lotes.value, cabecalho]

      return cabecalho
    },

    async obterLote(id: string): Promise<Lote | null> {
      await carregar()

      const cabecalho = lotes.value.find((lote) => lote.id === id)

      if (!cabecalho) return null

      const gravadas = await obter<LinhasGravadas>(LOJAS.linhasLote, id)

      return { ...cabecalho, linhas: gravadas?.linhas ?? [] }
    },

    /** Um funcionario de um lote, para reabrir na tela do calculo. */
    async obterLinha(loteId: string, linhaId: string): Promise<LinhaLote | null> {
      const gravadas = await obter<LinhasGravadas>(LOJAS.linhasLote, loteId)

      return gravadas?.linhas.find((linha) => linha.id === linhaId) ?? null
    },

    async excluirLote(id: string) {
      await aplicar([
        { loja: LOJAS.lotes, excluir: id },
        { loja: LOJAS.linhasLote, excluir: id },
      ])

      lotes.value = lotes.value.filter((lote) => lote.id !== id)
    },
  }
}
