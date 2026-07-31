import { formatCurrencyBRL } from "../utils/format";

const cards = [
  {
    key: "revenue",
    label: "Receita realizada",
    getValue: ({ totalRevenue }) => formatCurrencyBRL(totalRevenue),
    getHelper: ({ metricScopeLabel }) => `Concluidos ${metricScopeLabel}`,
  },
  {
    key: "appointments",
    label: "Agenda ativa",
    getValue: ({ appointmentsCount }) => appointmentsCount,
    getHelper: ({ metricScopeLabel }) => `Pendentes e confirmados ${metricScopeLabel}`,
  },
  {
    key: "clients",
    label: "Clientes",
    getValue: ({ clientsCount }) => clientsCount,
    getHelper: () => "Base cadastrada",
  },
  {
    key: "services",
    label: "Servicos",
    getValue: ({ servicesCount }) => servicesCount,
    getHelper: () => "Publicados na barbearia",
  },
];

export default function DashboardCards({
  totalRevenue,
  appointmentsCount,
  clientsCount,
  servicesCount,
  metricScopeLabel = "na janela carregada",
}) {
  const values = { totalRevenue, appointmentsCount, clientsCount, servicesCount, metricScopeLabel };

  return (
    <section
      className="mt-6 grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}
    >
      {cards.map((card) => (
        <div
          key={card.key}
          className="flex min-h-[120px] flex-col justify-between rounded-2xl border border-gray-800 bg-gray-900 p-6"
        >
          <p className="text-sm font-medium text-gray-400">{card.label}</p>
          <div>
            <h3 className="text-2xl font-extrabold text-white sm:text-3xl">
              {card.getValue(values)}
            </h3>
            <p className="mt-2 text-xs text-gray-500">{card.getHelper(values)}</p>
          </div>
        </div>
      ))}
    </section>
  );
}
