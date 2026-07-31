import { useMemo, useState } from "react";
import { createWhatsAppUrl } from "../utils/phone";

const templates = [
  {
    id: "reminder",
    label: "Lembrete de agendamento",
    intent: "Confirmacao",
    message:
      "Oi {clientName}, aqui e da barbearia. Lembrete rapido: seu horario esta marcado para {date} as {time}. Pode confirmar pra gente?",
  },
  {
    id: "comeback",
    label: "Retorno do cliente",
    intent: "Reativacao",
    message:
      "Ola {clientName}, sentimos sua falta por aqui. Quer agendar um horario para renovar o visual esta semana?",
  },
  {
    id: "postservice",
    label: "Pos-atendimento",
    intent: "Relacionamento",
    message:
      "Valeu pela confianca, {clientName}. Foi um prazer te atender. Quando quiser, estamos prontos para o proximo corte.",
  },
];

const sampleData = {
  clientName: "Gabriel",
  date: "28/07",
  time: "14:30",
};

const renderTemplate = (message) =>
  message
    .replaceAll("{clientName}", sampleData.clientName)
    .replaceAll("{date}", sampleData.date)
    .replaceAll("{time}", sampleData.time);

export default function WhatsApp() {
  const [copied, setCopied] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || templates[0],
    [selectedTemplateId]
  );
  const previewMessage = renderTemplate(selectedTemplate.message);
  const whatsappUrl = createWhatsAppUrl({ message: previewMessage });

  function copyTemplate(text, id) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      window.setTimeout(() => {
        setCopied("");
      }, 2000);
    });
  }

  return (
    <main className="flex-1 overflow-y-auto p-4 text-white sm:p-6 lg:p-8">
      <div className="mb-8">
        <p className="text-sm uppercase tracking-[0.3em] text-indigo-300">Relacionamento</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight">WhatsApp</h1>
        <p className="mt-2 max-w-2xl text-gray-400">
          Use mensagens prontas para confirmar horarios, trazer clientes de volta e manter contato apos o atendimento.
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="grid gap-4 lg:grid-cols-3 xl:grid-cols-1">
          {templates.map((template) => {
            const selected = selectedTemplateId === template.id;
            return (
              <button
                key={template.id}
                type="button"
                onClick={() => setSelectedTemplateId(template.id)}
                className={`rounded-3xl border p-5 text-left shadow-sm transition ${
                  selected
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-gray-500">{template.intent}</p>
                    <h2 className="mt-3 text-xl font-semibold text-white">{template.label}</h2>
                  </div>
                  {selected && (
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-black">
                      Ativo
                    </span>
                  )}
                </div>
                <p className="mt-4 line-clamp-3 text-sm leading-6 text-gray-400">{template.message}</p>
              </button>
            );
          })}
        </section>

        <aside className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-6">
          <p className="text-sm uppercase tracking-[0.25em] text-gray-500">Preview</p>
          <h2 className="mt-3 text-2xl font-bold">{selectedTemplate.label}</h2>
          <p className="mt-2 text-sm text-gray-400">
            Exemplo preenchido com cliente, data e horario ficticios.
          </p>

          <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-5 text-gray-200">
            <p className="whitespace-pre-line break-words leading-7">{previewMessage}</p>
          </div>

          <div className="mt-6 grid gap-3">
            <button type="button"
              onClick={() => copyTemplate(selectedTemplate.message, selectedTemplate.id)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              {copied === selectedTemplate.id ? "Copiado" : "Copiar modelo"}
            </button>
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-2xl border border-gray-700 bg-gray-950 px-4 py-3 text-sm font-semibold text-gray-200 transition hover:border-gray-500"
            >
              Testar no WhatsApp
            </a>
          </div>

          <div className="mt-6 rounded-2xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-400">
            Variaveis aceitas: <span className="text-gray-200">{"{clientName}"}</span>,{" "}
            <span className="text-gray-200">{"{date}"}</span>,{" "}
            <span className="text-gray-200">{"{time}"}</span>.
          </div>
        </aside>
      </div>
    </main>
  );
}
