# Exattus

Plataforma única para cálculos de folha e tributos: folha mensal (salário proporcional, INSS e IRRF, com conferência do holerite), férias (1/3, abono pecuniário, INSS por competência e IRRF), conferências salvas e tabelas de parâmetros.

Vue 3 (Composition API) + TypeScript + Tailwind CSS 4 + Vue Router, com o design system Exattus (Headless UI e Hugeicons).

## Design system

- `src/assets/exattus/tokens.json`: tokens oficiais (cores dos temas claro e escuro, tipografia, espaçamento, raios, sombras). `tokens.css` é gerado a partir dele: `node scripts/gerar-tokens.mjs`.
- `src/assets/exattus/bundle.css`: classes `ex-*` dos componentes.
- `src/components/exattus/`: componentes Vue do design system (`ExButton`, `ExModal`, `ExSwitch`...) e o mapa de ícones `icons.ts` (ícone novo entra primeiro ali).
- `src/components/ui/`: componentes do app sobre o design system (`UiButton`, `UiField`, `UiTabs`...).
- Cores do Tailwind (`bg-surface`, `text-ink-muted`, `bg-primary`...) leem os tokens; `data-theme="dark"` no `<html>` troca o tema.

## Estrutura

```
src/
  domain/        Regras de negócio puras, sem Vue (valores em centavos, alíquotas em pontos-base)
    dinheiro.ts  Conversão e formatação de valores
    datas.ts     Datas em UTC e competências
    parametros.ts Tabelas oficiais (INSS, IRRF, Lei nº 15.270/2025)
    inss.ts      INSS progressivo e pró-labore, com teto
    irrf.ts      IRRF: deduções legais x desconto simplificado + redução
    folha.ts     Cálculo da folha mensal
    ferias.ts    Cálculo de férias e rateio por competência
  features/      Estado e validação dos formulários de cada cálculo
  stores/        Estado compartilhado (tabela INSS, conferências salvas, avisos)
  components/
    ui/          Design system (botões, campos, abas, modal, alertas...)
    calculo/     Blocos de resultado reutilizados (demonstrativo, memórias, conferência)
    layout/      Estrutura da aplicação (barra lateral, cabeçalho de página)
    exattus/     Componentes do design system Exattus
  views/         Telas: Folha mensal, Férias, Conferências salvas, Tabelas e parâmetros
  app/navegacao.ts  Fonte única dos menus e da trilha de navegação
```

## Comandos

```sh
npm install
npm run dev      # desenvolvimento
npm run build    # checagem de tipos + build de produção
```
