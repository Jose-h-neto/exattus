import { onBeforeUnmount, onMounted, type Directive } from 'vue'

/*
 * Navegacao por teclado para digitacao rapida.
 *
 * v-navegar-enter: dentro do elemento, Enter vai para o proximo campo e
 * Shift+Enter para o anterior (o conteudo do destino fica selecionado). No
 * ultimo campo, chama a funcao passada como valor da diretiva, se houver.
 */

const SELETOR_CAMPOS = [
  'input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]):not([disabled])',
  'input[type="radio"]:checked:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
].join(',')

function visivel(elemento: HTMLElement): boolean {
  return elemento.offsetParent !== null || elemento.getClientRects().length > 0
}

export function camposNavegaveis(raiz: HTMLElement): HTMLElement[] {
  return [...raiz.querySelectorAll<HTMLElement>(SELETOR_CAMPOS)].filter(visivel)
}

export function focarCampo(campo: HTMLElement | null | undefined) {
  if (!campo) return

  campo.focus()

  if (campo instanceof HTMLInputElement && ['text', 'search', 'tel', ''].includes(campo.type)) {
    campo.select()
  }
}

type AoTerminar = ((evento: KeyboardEvent) => void) | undefined

interface ElementoNavegavel extends HTMLElement {
  __navegarEnter?: (evento: KeyboardEvent) => void
  __aoTerminar?: AoTerminar
}

export const navegarEnter: Directive<ElementoNavegavel, AoTerminar> = {
  mounted(raiz, binding) {
    raiz.__aoTerminar = binding.value

    raiz.__navegarEnter = (evento: KeyboardEvent) => {
      const alvo = evento.target as HTMLElement

      if (
        evento.key !== 'Enter' ||
        evento.isComposing ||
        evento.ctrlKey ||
        evento.metaKey ||
        evento.altKey ||
        !alvo.matches(SELETOR_CAMPOS.replace(':checked', '')) ||
        alvo instanceof HTMLTextAreaElement
      ) {
        return
      }

      const campos = camposNavegaveis(raiz)
      const indice = campos.indexOf(alvo)

      if (indice < 0) return

      evento.preventDefault()

      const destino = campos[indice + (evento.shiftKey ? -1 : 1)]

      if (destino) {
        focarCampo(destino)
      } else if (!evento.shiftKey) {
        raiz.__aoTerminar?.(evento)
      }
    }

    raiz.addEventListener('keydown', raiz.__navegarEnter)
  },

  updated(raiz, binding) {
    raiz.__aoTerminar = binding.value
  },

  beforeUnmount(raiz) {
    if (raiz.__navegarEnter) raiz.removeEventListener('keydown', raiz.__navegarEnter)
  },
}

/* Atalhos globais ------------------------------------------------------ */

export interface Atalho {
  /** Tecla (KeyboardEvent.key), ex.: "s", "Enter", "?". */
  tecla: string
  ctrl?: boolean
  shift?: boolean
  /** Permite disparar com o foco num campo de texto. */
  emCampos?: boolean
  acao: (evento: KeyboardEvent) => void
}

export function emCampoDeTexto(alvo: EventTarget | null): boolean {
  const elemento = alvo as HTMLElement | null

  return Boolean(
    elemento &&
      (elemento.isContentEditable || elemento.matches?.('input, textarea, select, [role="combobox"]')),
  )
}

/** Registra atalhos de teclado enquanto o componente estiver montado. */
export function useAtalhos(atalhos: Atalho[]) {
  function aoTeclar(evento: KeyboardEvent) {
    if (evento.defaultPrevented || evento.isComposing) return

    for (const atalho of atalhos) {
      const ctrl = evento.ctrlKey || evento.metaKey

      if (
        evento.key.toLowerCase() === atalho.tecla.toLowerCase() &&
        ctrl === Boolean(atalho.ctrl) &&
        (atalho.shift === undefined || evento.shiftKey === atalho.shift) &&
        (atalho.emCampos || ctrl || !emCampoDeTexto(evento.target))
      ) {
        evento.preventDefault()
        atalho.acao(evento)
        return
      }
    }
  }

  onMounted(() => window.addEventListener('keydown', aoTeclar))
  onBeforeUnmount(() => window.removeEventListener('keydown', aoTeclar))
}
