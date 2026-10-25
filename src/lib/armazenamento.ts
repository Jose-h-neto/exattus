/* Acesso ao localStorage tolerante a navegacao privada e armazenamento bloqueado. */

export function lerJson<T>(chave: string, validar: (valor: unknown) => valor is T): T | null {
  try {
    const texto = localStorage.getItem(chave)

    if (!texto) {
      return null
    }

    const valor: unknown = JSON.parse(texto)

    return validar(valor) ? valor : null
  } catch {
    return null
  }
}

export function gravarJson(chave: string, valor: unknown): boolean {
  try {
    localStorage.setItem(chave, JSON.stringify(valor))
    return true
  } catch {
    return false
  }
}

export function removerChave(chave: string): void {
  try {
    localStorage.removeItem(chave)
  } catch {
    // Sem armazenamento disponivel: nada a remover.
  }
}
