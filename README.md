# BarberOS - Gestão para Barbearias

BarberOS é um sistema SaaS de gestão para barbearias com dashboard, agenda, clientes, serviços, equipe multi-barbeiro, página pública de agendamento e financeiro.

# Screenshots

## Dashboard
![Dashboard](./public/screenshots/dashboard.png)

## Página pública
![Booking](./public/screenshots/agendamento.png)

## Configuraçao
![MultiBarber](./public/screenshots/config.png)

## Login
![Login](./public/screenshots/login.png)

## Demo Online

Demo online do BarberOS em breve.

## Tecnologias

- React 19
- Vite
- Tailwind CSS
- React Router
- Firebase (Firestore)

## Instalação

1. Clone o repositório
2. Instale as dependências:
   ```bash
   npm install
   ```

3. Configure o Firebase:
   - Crie um projeto no [Firebase Console](https://console.firebase.google.com/)
   - Ative o Firestore Database
   - Copie o arquivo `.env.example` para `.env`
   - Preencha as variáveis de ambiente com suas configurações do Firebase

4. Execute o projeto:
   ```bash
   npm run dev
   ```

## Estrutura do Projeto

```
src/
├── components/     # Componentes reutilizáveis
├── pages/         # Páginas da aplicação
├── services/      # Configurações de serviços externos
└── App.jsx        # Componente principal
```

## Funcionalidades

- 📊 Dashboard com métricas gerais
- 👤 Gestão de clientes
- ✂️ Cadastro de serviços
- 📅 Agenda de agendamentos
- 💰 Controle financeiro
- 💬 Templates de WhatsApp
