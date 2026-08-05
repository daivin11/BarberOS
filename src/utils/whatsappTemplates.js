export const WHATSAPP_SAMPLE_DATA = {
  clientName: "Gabriel",
  date: "28/07",
  time: "14:30",
  barbershopName: "BarberOS Studio",
};

export const WHATSAPP_TEMPLATE_VARIABLES = ["clientName", "date", "time", "barbershopName"];

export const WHATSAPP_TEMPLATES = [
  {
    id: "reminder",
    label: "Lembrete de agendamento",
    intent: "Confirmacao",
    message:
      "Oi {clientName}, aqui e da {barbershopName}. Lembrete rapido: seu horario esta marcado para {date} as {time}. Pode confirmar pra gente?",
  },
  {
    id: "comeback",
    label: "Retorno do cliente",
    intent: "Reativacao",
    message:
      "Ola {clientName}, sentimos sua falta por aqui na {barbershopName}. Quer agendar um horario para renovar o visual esta semana?",
  },
  {
    id: "postservice",
    label: "Pos-atendimento",
    intent: "Relacionamento",
    message:
      "Valeu pela confianca, {clientName}. Foi um prazer te atender na {barbershopName}. Quando quiser, estamos prontos para o proximo corte.",
  },
  {
    id: "review",
    label: "Pedido de avaliacao",
    intent: "Reputacao",
    message:
      "Oi {clientName}, obrigado pela visita na {barbershopName}. Se curtiu o atendimento, sua avaliacao ajuda muito outros clientes a conhecerem nosso trabalho.",
  },
  {
    id: "reschedule",
    label: "Reagendamento",
    intent: "Agenda",
    message:
      "Ola {clientName}, precisamos ajustar seu horario de {date} as {time}. Pode responder aqui para combinarmos o melhor novo horario?",
  },
];

export const getWhatsAppTemplateById = (templateId) =>
  WHATSAPP_TEMPLATES.find((template) => template.id === templateId) || WHATSAPP_TEMPLATES[0];

export const renderWhatsAppTemplate = (message = "", data = WHATSAPP_SAMPLE_DATA) =>
  WHATSAPP_TEMPLATE_VARIABLES.reduce(
    (renderedMessage, variableName) =>
      renderedMessage.replaceAll(`{${variableName}}`, data[variableName] || ""),
    String(message || "")
  );
