# BarberOS 💈

Sistema SaaS de gestão para barbearias, criado para centralizar agendamentos, clientes, serviços, equipe e controle financeiro em uma experiência simples e responsiva.

🔗 **[Acessar demonstração online](https://trimly-inky.vercel.app)**

## Funcionalidades

- Dashboard com métricas do negócio
- Agenda e gerenciamento de agendamentos
- Cadastro de clientes e serviços
- Suporte a equipes com múltiplos barbeiros
- Página pública de agendamento
- Controle financeiro
- Templates de mensagens para WhatsApp
- Interface responsiva

## Screenshots

### Dashboard

![Dashboard do BarberOS](./public/screenshots/dashboard.png)

### Agendamento público

![Página pública de agendamento](./public/screenshots/agendamento.png)

### Configurações

![Configurações da equipe](./public/screenshots/config.png)

### Login

![Tela de login](./public/screenshots/login.png)

## Tecnologias

- React 19
- Vite
- Tailwind CSS
- React Router
- Firebase e Firestore

## Como executar

### Pré-requisitos

- Node.js 18 ou superior
- Um projeto no Firebase

### Instalação

1. Clone o projeto: git clone https://github.com/daivin11/BarberOS.git
2. Entre na pasta: cd BarberOS
3. Instale as dependências: npm install
4. Copie .env.example para .env
5. Preencha as credenciais do Firebase
6. Execute npm run dev

## Estrutura principal

- src/components: componentes reutilizáveis
- src/pages: páginas da aplicação
- src/services: integrações e serviços externos
- src/App.jsx: componente principal

## Próximas melhorias

- [ ] Testes automatizados
- [ ] Relatórios financeiros
- [ ] Notificações de agendamento
- [ ] Melhorias de acessibilidade
- [ ] Painel de indicadores avançados

## Autor

Desenvolvido por [David Soares](https://github.com/daivin11).
