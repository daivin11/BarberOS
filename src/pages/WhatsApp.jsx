import { useState } from "react";

const templates = [
  {
    id: "reminder",
    label: "Lembrete de agendamento",
    message:
      "Oi {clientName}, aqui é da barbearia BarberOS! Lembrete rápido: seu horário está marcado para {date} às {time}. Confirma pra gente? 💈",
  },
  {
    id: "comeback",
    label: "Mensagem de retorno do cliente",
    message:
      "Olá {clientName}, sentimos sua falta na barbearia! Quer agendar um horário para renovar o visual e ficar ainda mais estiloso? 😊",
  },
  {
    id: "postservice",
    label: "Mensagem pós-atendimento",
    message:
      "Valeu pela confiança, {clientName}! Foi um prazer te atender. Quando quiser, estamos prontos para o próximo corte. ✂️",
  },
];

export default function WhatsApp() {
  const [copied, setCopied] = useState("");

  function copyTemplate(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      window.setTimeout(() => {
        setCopied("");
      }, 2000);
    });
  }

  return (
    <main className="flex-1 p-6 md:p-8 text-white overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">WhatsApp</h1>
        <p className="text-gray-400 mt-2 max-w-2xl">
          Use modelos prontos para lembrar clientes, convidar retornos e fortalecer o pós-atendimento.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {templates.map((template) => (
          <section
            key={template.id}
            className="rounded-3xl border border-gray-800 bg-gray-900 p-6 shadow-sm"
          >
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-xl font-semibold">{template.label}</h2>
                <p className="text-sm text-gray-500 mt-1">Copie e use no WhatsApp.</p>
              </div>
              <button
                onClick={() => copyTemplate(template.message, template.id)}
                className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-gray-200"
              >
                {copied === template.id ? "Copiado!" : "Copiar"}
              </button>
            </div>

            <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4 text-gray-200">
              <p className="whitespace-pre-line break-words">{template.message}</p>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
