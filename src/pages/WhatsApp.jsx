import { useMemo, useState } from "react";
import { createWhatsAppUrl } from "../utils/phone";
import {
  getWhatsAppTemplateById,
  renderWhatsAppTemplate,
  WHATSAPP_TEMPLATES,
  WHATSAPP_TEMPLATE_VARIABLES,
} from "../utils/whatsappTemplates";
import { reportError, trackEvent } from "../utils/telemetry";
import { copyTextToClipboard } from "../utils/clipboard";

export default function WhatsApp() {
  const [copied, setCopied] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState(WHATSAPP_TEMPLATES[0].id);

  const selectedTemplate = useMemo(
    () => getWhatsAppTemplateById(selectedTemplateId),
    [selectedTemplateId]
  );
  const previewMessage = renderWhatsAppTemplate(selectedTemplate.message);
  const whatsappUrl = createWhatsAppUrl({ message: previewMessage });

  async function copyTemplate(text, id) {
    const copiedToClipboard = await copyTextToClipboard(text);
    if (copiedToClipboard) {
      setCopied(id);
      trackEvent("whatsapp_template_copied", { source: "whatsapp", action: "copy-template" });
      window.setTimeout(() => {
        setCopied("");
      }, 2000);
      return;
    }

    reportError(new Error("clipboard-unavailable"), { source: "whatsapp", action: "copy-template" });
    setCopied("error");
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
          {WHATSAPP_TEMPLATES.map((template) => {
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
            <button
              type="button"
              onClick={() => copyTemplate(selectedTemplate.message, selectedTemplate.id)}
              className="rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-black transition hover:bg-gray-200"
            >
              {copied === selectedTemplate.id ? "Copiado" : "Copiar modelo"}
            </button>
            {copied === selectedTemplate.id && (
              <p className="text-sm text-emerald-300" role="status" aria-live="polite">
                Modelo copiado para a area de transferencia.
              </p>
            )}
            {copied === "error" && (
              <p
                className="rounded-2xl border border-red-800 bg-red-950/70 p-3 text-sm text-red-100"
                role="alert"
                aria-live="assertive"
              >
                Nao foi possivel copiar automaticamente. Selecione o texto do preview e copie manualmente.
              </p>
            )}
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
            Variaveis aceitas:{" "}
            {WHATSAPP_TEMPLATE_VARIABLES.map((variableName, index) => (
              <span key={variableName}>
                <span className="text-gray-200">{`{${variableName}}`}</span>
                {index < WHATSAPP_TEMPLATE_VARIABLES.length - 1 ? ", " : "."}
              </span>
            ))}
          </div>
        </aside>
      </div>
    </main>
  );
}
