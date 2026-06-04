import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { collection, getDocs, addDoc, query, where } from "firebase/firestore";
import { db } from "../services/firebase";

export default function PublicBooking() {
  const { slug } = useParams();
  const [barber, setBarber] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  // Generate time slots from 09:00 to 18:00 in 30-minute intervals
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 9; hour <= 17; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        slots.push(`${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`);
      }
    }
    return slots;
  };

  // Get booked times for the selected date and selected barber
  const getBookedTimes = () => {
    if (!date || !selectedBarber) return [];

    return appointments
      .filter((apt) => {
        if (apt.status === "cancelled") return false;
        if (apt.date !== date) return false;
        if (apt.barberId) {
          return apt.barberId === selectedBarber.id;
        }
        return selectedBarber.id === barber.uid;
      })
      .map((apt) => apt.time);
  };

  // Check if a time slot is available
  const isTimeAvailable = (timeSlot) => {
    return !getBookedTimes().includes(timeSlot);
  };

  const timeSlots = generateTimeSlots();
  const bookedTimes = getBookedTimes();
  const availableSlots = selectedBarber && date ? timeSlots.filter((slot) => isTimeAvailable(slot)) : [];

  const routeSlug = typeof slug === "string" ? slug.trim() : "";
  const publicPath = barber?.slug ? `/${barber.slug}` : routeSlug ? `/${routeSlug}` : null;
  const isBarberLoaded = !!barber && !!barber.uid;

  useEffect(() => {
    const loadBarberAndServices = async () => {
      setLoading(true);
      setError("");
      setBarber(null);
      setServices([]);
      setAppointments([]);
      setSuccess(false);

      if (!routeSlug) {
        setError("Slug inválido ou ausente. Verifique o endereço público do barbeiro.");
        setLoading(false);
        return;
      }

      try {
        const usersQuery = query(collection(db, "users"), where("slug", "==", routeSlug));
        const usersSnapshot = await getDocs(usersQuery);

        if (usersSnapshot.empty) {
          setError("Barbeiro não encontrado. Verifique o link ou peça ao seu barbeiro o endereço correto.");
          return;
        }

        const barberDoc = usersSnapshot.docs[0];
        const barberData = { id: barberDoc.id, uid: barberDoc.id, ...barberDoc.data() };
        setBarber(barberData);

        const servicesQuery = query(collection(db, "services"), where("userId", "==", barberData.uid));
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesList = servicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setServices(servicesList);

        const barbersQuery = query(collection(db, "barbers"), where("ownerId", "==", barberData.uid));
        const barbersSnapshot = await getDocs(barbersQuery);
        const barbersList = barbersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

        const normalizedBarbers =
          barbersList.length > 0
            ? barbersList
            : [
                {
                  id: barberData.uid,
                  name: barberData.barbershopName || barberData.displayName || "Equipe",
                  specialty: barberData.bio || "Especialista em cortes",
                  avatar: barberData.avatar || "",
                  ownerId: barberData.uid,
                },
              ];

        setBarbers(normalizedBarbers);
        setSelectedBarber(normalizedBarbers[0] || null);

        const appointmentsQuery = query(collection(db, "appointments"), where("userId", "==", barberData.uid));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAppointments(appointmentsList);
      } catch (err) {
        console.error(err);
        setError("Erro ao carregar os dados da barbearia. Tente novamente mais tarde.");
      } finally {
        setLoading(false);
      }
    };

    loadBarberAndServices();
  }, [routeSlug]);

  const bookAppointment = async () => {
    if (!barber || !barber.uid) {
      setError("Dados do barbeiro não disponíveis. Atualize a página e tente novamente.");
      return;
    }

    if (!selectedBarber) {
      setError("Selecione um barbeiro antes de agendar.");
      return;
    }

    if (!name || !phone || !selectedService || !date || !time) {
      setError("Preencha todos os campos para agendar o seu horário.");
      return;
    }

    if (!isTimeAvailable(time)) {
      setError("Este horário não está mais disponível. Escolha outro horário.");
      return;
    }

    const service = services.find((serviceItem) => serviceItem.id === selectedService);
    if (!service) {
      setError("Selecione um serviço válido.");
      return;
    }

    setSubmitLoading(true);
    setError("");

    try {
      const clientQuery = query(
        collection(db, "clients"),
        where("userId", "==", barber.uid),
        where("phone", "==", phone)
      );

      const clientSnapshot = await getDocs(clientQuery);
      let clientRecord;

      if (!clientSnapshot.empty) {
        clientRecord = { id: clientSnapshot.docs[0].id, ...clientSnapshot.docs[0].data() };
      } else {
        const newClient = {
          name,
          phone,
          createdAt: new Date(),
          userId: barber.uid,
          barberSlug: routeSlug,
        };
        const clientRef = await addDoc(collection(db, "clients"), newClient);
        clientRecord = { id: clientRef.id, ...newClient };
      }

      await addDoc(collection(db, "appointments"), {
        clientId: clientRecord.id,
        client: {
          id: clientRecord.id,
          name: clientRecord.name,
          phone: clientRecord.phone,
        },
        clientName: clientRecord.name,
        clientPhone: clientRecord.phone,
        service,
        barberId: selectedBarber?.id,
        barberName: selectedBarber?.name,
        date,
        time,
        status: "pending",
        userId: barber.uid,
        barberSlug: routeSlug,
        createdAt: new Date(),
      });

      setSuccess(true);
      setName("");
      setPhone("");
      setSelectedService("");
      setDate("");
      setTime("");

      const appointmentsQuery = query(collection(db, "appointments"), where("userId", "==", barber.uid));
      const appointmentsSnapshot = await getDocs(appointmentsQuery);
      const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setAppointments(appointmentsList);
    } catch (err) {
      console.error(err);
      setError("Erro ao enviar o agendamento. Tente novamente.");
    } finally {
      setSubmitLoading(false);
    }
  };

  const brandName = barber?.barbershopName || barber?.displayName || "Barbearia premium";
  const barberName = barber?.displayName || barber?.barbershopName || "Seu barbeiro";
  const brandTagline = barber?.bio || "Agende online o seu próximo corte de forma rápida e elegante.";
  const displayPath = publicPath || (routeSlug ? `/${routeSlug}` : "/link-indisponivel");

  return (
    <main className="min-h-screen bg-gray-950 text-white px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 space-y-6">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-sm uppercase tracking-[0.35em] text-indigo-300">
                  Agendamento online
                </span>
                <div className="space-y-3">
                  <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">{brandName}</h1>
                  <p className="text-lg text-gray-400 sm:text-xl">{brandTagline}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                  <span className="rounded-full bg-white/5 px-4 py-2">{barberName}</span>
                  {barber?.bio && <span className="rounded-full bg-white/5 px-4 py-2">{barber.bio}</span>}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5 text-sm text-gray-300">
                <p className="font-semibold text-white">Agendamento público</p>
                <p className="mt-4 text-sm leading-6 text-gray-400">
                  Escolha um serviço, selecione data e horário e confirme seu agendamento de forma rápida.
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-10 text-center text-gray-400">Carregando...</div>
        ) : error ? (
          <div className="rounded-3xl border border-red-600 bg-red-950 p-10 text-center text-red-400">{error}</div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Barbeiros</p>
                    <h2 className="mt-3 text-2xl font-bold">Escolha o barbeiro</h2>
                  </div>
                  <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">{barbers.length} opções</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {barbers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-8 text-center text-gray-400">
                      Nenhum barbeiro disponível no momento.
                    </div>
                  ) : (
                    barbers.map((barberItem) => {
                      const selected = selectedBarber?.id === barberItem.id;
                      return (
                        <button
                          key={barberItem.id}
                          type="button"
                          onClick={() => {
                            setSelectedBarber(barberItem);
                            setTime("");
                          }}
                          className={`flex min-h-[120px] flex-col justify-between rounded-3xl border p-5 text-left transition ${
                            selected
                              ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                              : "border-gray-800 bg-gray-950 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="h-14 w-14 rounded-3xl bg-white/10 flex items-center justify-center text-2xl text-indigo-300">
                              {barberItem.avatar ? (
                                <img src={barberItem.avatar} alt={barberItem.name} className="h-14 w-14 rounded-3xl object-cover" />
                              ) : (
                                barberItem.name?.split(" ").map((word) => word[0]).join("")
                              )}
                            </div>
                            <div>
                              <p className="text-lg font-semibold text-white">{barberItem.name}</p>
                              <p className="mt-2 text-sm text-gray-400">{barberItem.specialty || "Especialista"}</p>
                            </div>
                          </div>
                          {selected && <span className="mt-4 inline-flex rounded-full bg-indigo-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-indigo-200">Selecionado</span>}
                        </button>
                      );
                    })
                  )}
                </div>

                <div className="mt-6 rounded-3xl border border-gray-800 bg-gray-950 p-4">
                  <p className="text-sm text-gray-400">Barbeiro selecionado</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedBarber ? selectedBarber.name : "Escolha um barbeiro acima"}
                  </p>
                  {selectedBarber?.specialty && <p className="mt-1 text-sm text-gray-400">{selectedBarber.specialty}</p>}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Serviços</p>
                    <h2 className="mt-3 text-2xl font-bold">Escolha o serviço ideal</h2>
                  </div>
                  <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">{services.length} serviços</span>
                </div>

                {services.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-8 text-center text-gray-400">
                    Não há serviços publicados ainda. Peça ao barbeiro para cadastrar seus serviços.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {services.map((service) => {
                      const selected = selectedService === service.id;
                      const duration = service.duration ? `${service.duration} min` : "30 min";
                      return (
                        <button
                          key={service.id}
                          type="button"
                          onClick={() => setSelectedService(service.id)}
                          className={`flex flex-col justify-between rounded-3xl border p-6 text-left transition ${
                            selected
                              ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                              : "border-gray-800 bg-gray-950 hover:border-white/20"
                          }`}
                        >
                          <div>
                            <p className="text-xl font-semibold text-white">{service.name}</p>
                            <p className="mt-3 text-sm text-gray-400">{duration}</p>
                          </div>
                          <div className="mt-6 flex items-center justify-between gap-4">
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">R$ {service.price}</span>
                            {selected && <span className="rounded-full bg-indigo-500 px-3 py-1 text-sm text-white">Selecionado</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
                <h2 className="text-2xl font-bold">Como funciona</h2>
                <ol className="mt-5 space-y-3 text-gray-400">
                  <li>1. Escolha o serviço desejado.</li>
                  <li>2. Informe seus dados de contato.</li>
                  <li>3. Selecione a data.</li>
                  <li>4. Escolha um horário disponível (em verde).</li>
                  <li>5. Clique em reservar e aguarde a confirmação.</li>
                </ol>
                <p className="mt-5 text-sm text-gray-500 border-t border-gray-800 pt-5">
                  💡 <span className="text-red-400">Horários em vermelho</span> já estão ocupados. Escolha outro horário ou data.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-8 shadow-sm">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Agendar horário</h2>
                <p className="text-gray-400 mt-2">Preencha seus dados para confirmar o seu agendamento.</p>
              </div>

              {success && (
                <div className="mb-6 rounded-3xl border border-emerald-500 bg-emerald-950 p-4 text-emerald-300">
                  Agendamento confirmado! O barbeiro receberá a solicitação e entrará em contato.
                </div>
              )}

              <div className="grid gap-4">
                <input
                  className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none"
                  placeholder="Seu nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                <input
                  className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none"
                  placeholder="Telefone com DDD"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
                <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4">
                  <p className="text-sm text-gray-400">Serviço selecionado</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedService
                      ? services.find((service) => service.id === selectedService)?.name
                      : "Selecione um serviço acima"}
                  </p>
                </div>
                <div className="rounded-3xl border border-indigo-500 bg-indigo-500/10 p-5 shadow-lg shadow-indigo-500/10 transition hover:border-indigo-400 hover:bg-indigo-500/15">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">
                        2. Escolha a data
                      </p>
                      <p className="mt-2 text-sm text-gray-300 max-w-md">
                        Selecione o dia que mais combina com você. As datas mostram os horários disponíveis apenas depois da seleção.
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white">
                      <span>📅</span>
                      <span>Data</span>
                    </div>
                  </div>
                  <div className="mt-5 rounded-3xl border border-gray-800 bg-gray-950 p-4 transition hover:border-white/20 focus-within:border-white/20">
                    <input
                      className="w-full cursor-pointer rounded-3xl border border-transparent bg-transparent px-3 py-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-400 focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20"
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  {!date && (
                    <p className="mt-4 text-sm text-gray-400">
                      Primeiro selecione a data desejada para conferir os horários disponíveis.
                    </p>
                  )}
                </div>
                {date && (
                  <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">3. Escolha o horário</p>
                        <p className="mt-2 text-base text-white">Horários disponíveis para {new Date(date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className="rounded-full bg-gray-900 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                        {selectedBarber ? `${availableSlots.length} disponível${availableSlots.length === 1 ? "" : "s"}` : "Selecione um barbeiro"}
                      </span>
                    </div>

                    {!selectedBarber ? (
                      <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-5 text-sm text-gray-300">
                        Selecione um barbeiro primeiro para ver os horários disponíveis.
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                        {timeSlots.map((slot) => {
                          const isAvailable = isTimeAvailable(slot);
                          const isSelected = time === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => isAvailable && setTime(slot)}
                              disabled={!isAvailable}
                              className={`rounded-3xl border px-3 py-3 text-sm font-semibold transition ${
                                isSelected
                                  ? "bg-white text-black border-white"
                                  : isAvailable
                                  ? "border-gray-800 bg-gray-950 text-white hover:border-white/40 hover:bg-gray-800"
                                  : "border-red-900 bg-red-950 text-red-300 cursor-not-allowed opacity-70"
                              }`}
                            >
                              <div>{slot}</div>
                              {!isAvailable && <span className="block text-xs text-red-400 mt-1">Ocupado</span>}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-3xl border border-dashed border-yellow-500 bg-yellow-950 p-5 text-sm text-yellow-200">
                        <p className="font-semibold">Sem horários disponíveis</p>
                        <p className="mt-2 text-gray-300">
                          Não há horários livres neste dia. Escolha outra data ou volte ao serviço para alterar a seleção.
                        </p>
                      </div>
                    )}

                    {bookedTimes.length > 0 && availableSlots.length > 0 && (
                      <p className="text-xs text-gray-400 mt-3">
                        {bookedTimes.length} horário(s) já ocupado(s) nesta data.
                      </p>
                    )}
                  </div>
                )}

                <button
                  className={`w-full rounded-3xl py-4 text-sm font-semibold transition ${
                    selectedBarber && selectedService && name && phone && date && time && !submitLoading
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={bookAppointment}
                  disabled={!selectedBarber || !selectedService || !name || !phone || !date || !time || submitLoading}
                >
                  {submitLoading ? "Enviando..." : "Confirmar agendamento"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
