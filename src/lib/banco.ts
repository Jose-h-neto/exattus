/*
 * IndexedDB minimo, sem biblioteca. Usado pelo cofre de lotes, que pode
 * passar do limite de ~5 MB do localStorage com lotes grandes.
 * Os dados ficam apenas neste navegador.
 */

const NOME_BANCO = 'exattus'
const VERSAO = 1

export const LOJAS = {
  empresas: 'empresas',
  lotes: 'lotes',
  linhasLote: 'linhasLote',
} as const

export type Loja = (typeof LOJAS)[keyof typeof LOJAS]

let conexao: Promise<IDBDatabase> | null = null

export function abrirBanco(): Promise<IDBDatabase> {
  conexao ??= new Promise<IDBDatabase>((resolver, rejeitar) => {
    if (typeof indexedDB === 'undefined') {
      rejeitar(new Error('Este navegador não permite guardar dados (IndexedDB indisponível).'))
      return
    }

    const pedido = indexedDB.open(NOME_BANCO, VERSAO)

    pedido.onupgradeneeded = () => {
      const banco = pedido.result

      if (!banco.objectStoreNames.contains(LOJAS.empresas)) {
        banco.createObjectStore(LOJAS.empresas, { keyPath: 'id' })
      }

      if (!banco.objectStoreNames.contains(LOJAS.lotes)) {
        banco.createObjectStore(LOJAS.lotes, { keyPath: 'id' }).createIndex('empresaId', 'empresaId')
      }

      if (!banco.objectStoreNames.contains(LOJAS.linhasLote)) {
        banco.createObjectStore(LOJAS.linhasLote, { keyPath: 'loteId' })
      }
    }

    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error ?? new Error('Não foi possível abrir o armazenamento do navegador.'))
    pedido.onblocked = () => rejeitar(new Error('Feche as outras abas do Exattus e recarregue a página.'))
  }).catch((erro) => {
    conexao = null
    throw erro
  })

  return conexao
}

function aguardar<T>(pedido: IDBRequest<T>): Promise<T> {
  return new Promise((resolver, rejeitar) => {
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rejeitar(pedido.error)
  })
}

/** Copia simples: proxies reativos do Vue nao podem ser gravados no IndexedDB. */
function semReatividade<T>(valor: T): T {
  return JSON.parse(JSON.stringify(valor)) as T
}

export async function listar<T>(loja: Loja): Promise<T[]> {
  const banco = await abrirBanco()

  return aguardar(banco.transaction(loja, 'readonly').objectStore(loja).getAll() as IDBRequest<T[]>)
}

export async function obter<T>(loja: Loja, chave: string): Promise<T | undefined> {
  const banco = await abrirBanco()

  return aguardar(banco.transaction(loja, 'readonly').objectStore(loja).get(chave) as IDBRequest<T | undefined>)
}

export interface OperacaoBanco {
  loja: Loja
  gravar?: unknown
  excluir?: string
}

/** Grava e exclui em uma unica transacao: ou tudo e aplicado, ou nada. */
export async function aplicar(operacoes: readonly OperacaoBanco[]): Promise<void> {
  const banco = await abrirBanco()
  const lojas = [...new Set(operacoes.map((operacao) => operacao.loja))]
  const transacao = banco.transaction(lojas, 'readwrite')

  for (const operacao of operacoes) {
    const loja = transacao.objectStore(operacao.loja)

    if (operacao.gravar !== undefined) loja.put(semReatividade(operacao.gravar))
    if (operacao.excluir !== undefined) loja.delete(operacao.excluir)
  }

  await new Promise<void>((resolver, rejeitar) => {
    transacao.oncomplete = () => resolver()
    transacao.onerror = () => rejeitar(transacao.error ?? new Error('Não foi possível gravar os dados.'))
    transacao.onabort = () => rejeitar(transacao.error ?? new Error('A gravação foi cancelada (armazenamento cheio?).'))
  })
}
