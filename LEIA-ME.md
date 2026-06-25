# Painel do Motorista — Guia rápido

## O que é
Um app web (PWA) que funciona como app instalado no Android: ícone na tela inicial,
tela cheia, funciona offline. Todos os dados ficam só no seu celular (localStorage) —
nada é enviado para a internet, exceto quando você mesmo exporta um arquivo.

## Como instalar no celular

Como o app não está numa loja, ele precisa estar hospedado num link (https) pra dar
para "instalar" pelo Chrome. A forma mais simples e gratuita é o **GitHub Pages**:

1. Crie uma conta gratuita em github.com (se não tiver).
2. Crie um repositório novo (pode ser privado), por exemplo `painel-motorista`.
3. Suba os 8 arquivos deste zip para esse repositório (mantenha a pasta `icons/` dentro).
4. Vá em **Settings → Pages**, escolha a branch `main` e pasta `/ (root)`, salve.
5. Em alguns minutos o GitHub te dá um link tipo `https://seunome.github.io/painel-motorista/`.
6. Abra esse link no Chrome do celular.
7. Toque no menu (⋮) → **"Adicionar à tela inicial"** ou **"Instalar app"**.
8. Pronto — vai aparecer um ícone como qualquer outro app instalado.

> Alternativa mais simples (sem GitHub): existem serviços gratuitos de hospedagem
> estática por arrastar-e-soltar, como o Netlify Drop (app.netlify.com/drop) — você
> arrasta a pasta extraída do zip e ele te dá um link na hora, sem precisar criar conta
> em alguns casos. O resultado final é o mesmo.

## Como usar

- **Lançar**: toda vez que quiser, registre o que cada app (Uber, 99, InDriver,
  Particular) te mostrou de ganho e km naquele dia. Se preencher de novo no mesmo dia,
  o app atualiza em vez de duplicar — então pode corrigir um lançamento antigo sem medo.
- **Km real**: no mesmo formulário de ganho, tem um campo separado pra você colocar o
  km total rodado de verdade (incluindo deslocamento até o passageiro e tempo
  rodando à procura de corrida). É opcional, mas é o que alimenta o gráfico de
  "ganho por km real" nos Gráficos.
- **Painel**: mostra o resumo do período (diária/semanal/mensal/anual), com o
  gráfico de pizza Faturamento × Despesas e o detalhamento por app.
- **Gráficos**: comparações mês a mês e ano a ano — lucro, faturamento x despesas,
  ganho/km por app, média geral, e o comparativo de ganho/km segundo o app vs km real.
- **Ajustes**: gerenciar categorias de despesa, ativar/desativar apps que você não usa,
  exportar a planilha CSV, e fazer backup/restauração dos dados.

## Exportar para o Google Planilhas

Em Ajustes → "Baixar planilha (.csv)". O arquivo vem com 4 blocos dentro dele:
DIÁRIA, SEMANAL, MENSAL e ANUAL, cada um já com os totais calculados (faturamento,
despesas, lucro, km, ganho/km do app e ganho/km real).

Para deixar em abas separadas como no seu pedido original:
1. Suba o .csv para o Google Drive.
2. Abra com o Google Planilhas (ele abre automaticamente).
3. Vai abrir tudo numa aba só, com os blocos separados por linhas "### NOME DO BLOCO".
4. Se quiser separar em 4 abas de verdade: selecione cada bloco de linhas, copie
   (Ctrl+C), crie uma aba nova (+ no rodapé), cole (Ctrl+V). Leva menos de 2 minutos.

## Backup

Como os dados ficam só no celular, se você trocar de aparelho ou limpar os dados do
navegador, eles se perdem. Por isso, em Ajustes existe "Exportar backup" — gera um
.json com tudo. Guarde esse arquivo (no Drive, por exemplo) e use "Importar backup"
se precisar restaurar.

## Limitações importantes

- Os dados não sincronizam entre dispositivos — é só local, como você pediu.
- Se limpar o cache/dados do site no navegador, os lançamentos somem (use o backup).
- O app funciona offline depois da primeira vez que carrega.
