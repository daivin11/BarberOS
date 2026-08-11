# Manual do dono do BarberOS

Este guia existe para voce operar o projeto sem precisar entender todo o codigo manualmente.

Nao e um problema voce nao saber fazer tudo que foi implementado. O problema seria nao entender o produto, o fluxo do cliente, os riscos principais e como validar se uma versao esta pronta para mostrar.

## O que voce precisa dominar primeiro

Prioridade maxima:

- O que o BarberOS promete para uma barbearia.
- Como demonstrar o fluxo completo em 10 minutos.
- Como criar uma conta, configurar perfil, servicos, barbeiros e horarios.
- Como testar um agendamento publico.
- Como rodar a validacao de release.
- Como saber se algo quebrou antes de mostrar para alguem.

Voce nao precisa decorar React, Firebase Rules ou bundle splitting agora. Isso vem por partes.

## Comandos essenciais

Instalar dependencias:

```bash
npm install
```

Rodar localmente:

```bash
npm run dev
```

Validar antes de demonstrar ou publicar:

```bash
npm run check:release
```

Publicar regras e indices do Firestore:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project trimly-4daee
```

Publicar somente regras:

```bash
firebase deploy --only firestore:rules --project trimly-4daee
```

## O que significa cada validacao

`npm run lint` procura problemas de codigo e padrao.

`npm run check:production` bloqueia regressao de produto, seguranca, Firebase, marca antiga, configuracao e protecoes criticas.

`npm test` roda testes de regras de negocio, datas, agenda, WhatsApp, trial, clientes, servicos e utilitarios.

`npm run check:hosting` valida headers, fallback SPA e configuracoes de hospedagem.

`npm run build` cria a versao de producao.

`npm run check:bundle` impede que o app fique pesado demais sem perceber.

## Mapa rapido das pastas

- `src/pages`: telas principais do app.
- `src/components`: componentes reutilizaveis.
- `src/utils`: regras puras, validacoes, formatacao e funcoes testaveis.
- `src/contexts`: estado global de autenticacao e perfil.
- `src/services`: integracoes externas, como Firebase.
- `tests`: testes automatizados.
- `scripts`: checks de producao, hosting e bundle.
- `firestore.rules`: permissoes e validacoes do banco.
- `firestore.indexes.json`: indices usados por consultas do Firestore.
- `docs`: guias de produto, operacao e venda.

## Antes de mostrar para uma barbearia

Rode:

```bash
npm run check:release
```

Depois confira manualmente:

- Login funciona.
- Cadastro funciona.
- Perfil publico abre.
- Servico pode ser criado.
- Barbeiro pode ser criado.
- Cliente pode ser criado.
- Agenda cria agendamento.
- Link publico permite solicitar horario.
- WhatsApp gera mensagem correta.

## Quando voce deve pedir ajuda tecnica

Peca ajuda antes de mexer sozinho quando o tema envolver:

- `firestore.rules`.
- `firestore.indexes.json`.
- Autenticacao Firebase.
- App Check.
- Deploy de producao.
- Dados reais de clientes.
- Cobranca ou assinatura.
- Erros que envolvem permissao, seguranca ou perda de dados.

## Seu papel como fundador agora

Seu trabalho mais valioso agora nao e programar cada detalhe. E descobrir:

- Quem sente a dor com mais forca.
- Qual frase faz o dono entender o valor.
- Qual tela causa confusao.
- Qual recurso realmente faz alguem pagar.
- Quanto alguem aceita pagar.
- O que pode continuar manual por enquanto.

Codigo sem cliente vira hobby caro. Cliente sem codigo perfeito ainda pode virar negocio.
