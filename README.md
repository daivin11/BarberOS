# BarberOS

[![CI](https://github.com/daivin11/BarberOS/actions/workflows/ci.yml/badge.svg)](https://github.com/daivin11/BarberOS/actions/workflows/ci.yml)

BarberOS e um SaaS para barbearias com agenda online, clientes, servicos, equipe multi-barbeiro, financeiro, templates de WhatsApp e pagina publica de agendamento.

## Stack

- React
- Vite
- Tailwind CSS
- React Router
- Firebase Auth
- Cloud Firestore

## Requisitos

- Node.js 22 ou superior
- npm
- Firebase CLI, apenas para publicar regras e indices:

```bash
npm install -g firebase-tools
firebase login
```

## Ambiente

Copie `.env.example` para `.env` e preencha as variaveis publicas do Firebase:

```bash
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY=
```

Opcional:

```bash
VITE_SUPPORT_WHATSAPP=
VITE_AUTH_ACTION_URL=
VITE_ENABLE_CLIENT_LOGS=false
VITE_TELEMETRY_ENDPOINT=
```

`VITE_ENABLE_CLIENT_LOGS` deixa eventos e erros do front-end visiveis para diagnostico. Por padrao fica desligado.
Se `VITE_TELEMETRY_ENDPOINT` for informado, o app envia somente metadados seguros de erro/evento, sem nome, telefone, e-mail ou slug.
`VITE_AUTH_ACTION_URL` define o dominio usado como URL de continuidade nos e-mails do Firebase Auth, como redefinicao de senha. Em producao, aponte para o dominio publico do BarberOS.
`VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY` ativa Firebase App Check com reCAPTCHA v3 no front-end. Em producao, crie a chave no Firebase App Check e aplique enforcement em Auth/Firestore depois de validar o monitoramento.

## Desenvolvimento

```bash
npm install
npm run dev
```

## Validacao

```bash
npm run check:release
```

`check:release` executa lint, check de producao, testes, check de hosting, build e budget de bundle na ordem esperada para liberar uma versao.
Os testes atuais cobrem regras puras de horarios, slots, conflito de agenda, trial, billing, telefones, auth actions, onboarding, validacao de perfil e utilitarios de dados.
O check de producao bloqueia regressao obvia de marca antiga, alerts, placeholders, chaves hardcoded, regras Firestore perigosas e ausencia de protecoes criticas de dados.
O check de hosting valida fallback SPA, headers de seguranca, cache imutavel de assets e assets publicos de lancamento no Firebase Hosting e Vercel.
O check de bundle roda depois do build e impede crescimento excessivo de JS/CSS gzipado.

## CI

A cada push ou pull request para a branch principal, o GitHub Actions executa automaticamente:

- Instalacao reproduzivel com `npm ci`
- Portao de release com `npm run check:release`, incluindo lint, check de producao, testes, hosting, build e bundle budget

## Firebase

O projeto local esta configurado para o Firebase:

```text
trimly-4daee
```

Publicar regras e indices:

```bash
firebase deploy --only firestore:rules,firestore:indexes --project trimly-4daee
```

Publicar apenas regras:

```bash
firebase deploy --only firestore:rules --project trimly-4daee
```

## Hosting

O repositorio inclui configuracao para Vercel e Firebase Hosting:

- fallback SPA para rotas como `/dashboard`, `/login` e `/:slug`;
- cache imutavel para assets versionados em `/assets`;
- headers basicos de seguranca: `nosniff`, `DENY` para iframe, referrer policy, permissions policy e HSTS.

Antes do primeiro deploy publico, confirme o dominio final, configure `VITE_AUTH_ACTION_URL`, adicione o dominio em Firebase Auth > Authorized domains e ajuste os templates do Firebase Auth para usarem BarberOS.

## Funcionalidades

- Landing page do produto
- Registro, login e recuperacao de senha
- Trial gratuito com bloqueio apos expiracao
- Link publico pausado automaticamente quando trial/assinatura da conta nao esta ativo
- Modelo inicial de assinatura com status `trialing`, `active`, `past_due` e `cancelled`
- Solicitacao interna de renovacao/reativacao para contas bloqueadas
- Perfil publico da barbearia
- Horarios de funcionamento e datas bloqueadas
- Link publico de agendamento
- Agenda diaria e resumo semanal
- Cadastro de clientes com telefone normalizado
- Bloqueio de duplicidade de cliente por telefone
- Cadastro de servicos com duracao
- Equipe multi-barbeiro
- Edicao e cancelamento de agendamentos
- Arquivamento e restauracao de clientes, servicos e barbeiros sem perder historico
- Financeiro baseado em atendimentos concluidos
- Templates de WhatsApp
- Firestore rules e indices versionados

## Observacoes de producao

- As configuracoes do Firebase usadas no front-end sao publicas por natureza; a seguranca depende principalmente das Firestore Rules.
- Antes de publicar novas regras, rode `npm run check:release` e faca deploy restrito apenas do Firestore quando a alteracao for de banco.
- Antes de liberar trafego publico, configure Firebase App Check com reCAPTCHA v3, publique `VITE_FIREBASE_APPCHECK_RECAPTCHA_SITE_KEY` no ambiente de deploy e ative enforcement gradualmente no Firebase Console.
- Para ativar contato direto na tela de conta bloqueada, configure `VITE_SUPPORT_WHATSAPP`.
- O gateway de pagamento ainda nao esta implementado. Campos de assinatura e solicitacoes de renovacao existem para operacao manual/admin/server-side; o usuario nao pode ativar plano pago pelo front-end.
- Para diagnostico em producao, ative `VITE_ENABLE_CLIENT_LOGS=true` apenas com um endpoint proprio e seguro em `VITE_TELEMETRY_ENDPOINT`.
