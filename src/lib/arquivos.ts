/** Entrega um arquivo gerado no navegador para o usuario salvar. */
export function baixarArquivo(conteudo: Blob, nome: string): void {
  const url = URL.createObjectURL(conteudo)
  const link = document.createElement('a')

  link.href = url
  link.download = nome
  document.body.append(link)
  link.click()
  link.remove()
  // Alguns navegadores leem o blob depois do clique: libera a URL em seguida.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Nome de arquivo seguro a partir de um texto livre (ex.: nome da empresa). */
export function nomeDeArquivo(texto: string): string {
  return (
    texto
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'arquivo'
  )
}
