import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { collection, getDocs, query, where, orderBy, runTransaction, doc, limit } from "firebase/firestore";
import { db } from "../services/firebase";
import { createClientPhoneKeyId, createClientSnapshot, normalizeClientInput, validateClientInput } from "../utils/adminData";
import { APPOINTMENT_STATUS } from "../utils/appointments";
import { createAppointmentDateWindow, isDateWithinAppointmentWindow } from "../utils/appointmentWindow";
import { createBookingConfirmation, getBookingConfirmationLines } from "../utils/bookingConfirmation";
import { formatLocalDate } from "../utils/date";
import { formatCurrencyBRL, formatDuration, pluralize } from "../utils/format";
import { isValidBrazilianPhone, normalizePhone } from "../utils/phone";
import { createPrivacyConsentSnapshot, isPrivacyConsentAccepted } from "../utils/privacyConsent";
import { getAccountAccess } from "../utils/trial";
import {
  createSlotId,
  defaultBusinessHours,
  getOccupiedTimes,
  getTimeSlots,
  isFutureAppointmentStart,
  isTimeSlotAvailable,
  timeToMinutes,
} from "../utils/schedule";
import { createServiceSnapshot, getServiceCatalogDuration, getServiceCatalogPrice } from "../utils/services";
import { reportError, trackEvent } from "../utils/telemetry";

const PUBLIC_QUERY_LIMITS = {
  services: 100,
  barbers: 50,
  slotsByDay: 200,
};

export default function PublicBooking() {
  const { slug } = useParams();
  const [barber, setBarber] = useState(null);
  const [barbers, setBarbers] = useState([]);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [services, setServices] = useState([]);
  const [bookedSlots, setBookedSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [fatalError, setFatalError] = useState("");
  const [formError, setFormError] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [success, setSuccess] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [bookingConfirmation, setBookingConfirmation] = useState(null);

  const businessHours = barber?.businessHours || defaultBusinessHours;
  const blockedDates = Array.isArray(barber?.blockedDates) ? barber.blockedDates : [];
  const isBlockedDate = date ? blockedDates.includes(date) : false;
  const appointmentWindow = createAppointmentDateWindow();
  const selectedServiceData = services.find((serviceItem) => serviceItem.id === selectedService);
  const selectedDuration = getServiceCatalogDuration(selectedServiceData);

  // Get booked times for the selected date and selected barber
  const getBookedTimes = () => {
    if (!date || !selectedBarber) return [];

    return bookedSlots.filter((slot) => slot.date === date && slot.barberId === selectedBarber.id);
  };

  // Check if a time slot is available
  const isTimeAvailable = (timeSlot) => {
    return isTimeSlotAvailable({
      time: timeSlot,
      duration: selectedDuration,
      bookedSlots: getBookedTimes(),
    });
  };

  const timeSlots = getTimeSlots({ businessHours, duration: selectedDuration });
  const bookedTimes = getBookedTimes();
  const availableSlots =
    selectedBarber && date && !isBlockedDate ? timeSlots.filter((slot) => isTimeAvailable(slot)) : [];
  const hasPublishedServices = services.length > 0;
  const hasSelectableBarber = Boolean(selectedBarber);
  const cleanPhoneForSubmit = normalizePhone(phone);
  const canSubmit =
    hasPublishedServices &&
    hasSelectableBarber &&
    Boolean(selectedService) &&
    Boolean(name.trim()) &&
    isValidBrazilianPhone(cleanPhoneForSubmit) &&
    Boolean(date) &&
    Boolean(time) &&
    isPrivacyConsentAccepted(privacyAccepted) &&
    !slotsLoading &&
    timeSlots.includes(time) &&
    isTimeAvailable(time) &&
    !isBlockedDate &&
    isDateWithinAppointmentWindow(date, appointmentWindow) &&
    !submitLoading;
  const setupUnavailable = !hasPublishedServices || !hasSelectableBarber;

  const routeSlug = typeof slug === "string" ? slug.trim() : "";
  useEffect(() => {
    let isActive = true;

    const loadBarberAndServices = async () => {
      setLoading(true);
      setFatalError("");
      setFormError("");
      setBarber(null);
      setServices([]);
      setBookedSlots([]);
      setSuccess(false);
      setPrivacyAccepted(false);
      setBookingConfirmation(null);

      if (!routeSlug) {
        setFatalError("Slug invalido ou ausente. Verifique o endereco publico do barbeiro.");
        setLoading(false);
        return;
      }

      try {
        const usersQuery = query(
          collection(db, "publicProfiles"),
          where("slug", "==", routeSlug),
          where("profileComplete", "==", true),
          limit(1)
        );
        const usersSnapshot = await getDocs(usersQuery);
        if (!isActive) return;

        if (usersSnapshot.empty) {
          setFatalError("Barbeiro nao encontrado. Verifique o link ou peca ao seu barbeiro o endereco correto.");
          return;
        }

        const barberDoc = usersSnapshot.docs[0];
        const barberData = { id: barberDoc.id, uid: barberDoc.id, ...barberDoc.data() };
        const accountAccess = getAccountAccess(barberData);
        if (!accountAccess.active) {
          setFatalError("O agendamento online desta barbearia esta temporariamente pausado. Fale diretamente com a equipe para marcar seu horario.");
          return;
        }
        setBarber(barberData);

        const servicesQuery = query(
          collection(db, "services"),
          where("userId", "==", barberData.uid),
          where("isArchived", "==", false),
          orderBy("createdAt", "desc"),
          limit(PUBLIC_QUERY_LIMITS.services)
        );
        const servicesSnapshot = await getDocs(servicesQuery);
        if (!isActive) return;
        const servicesList = servicesSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((service) => !service.isArchived && !service.archivedAt);
        setServices(servicesList);

        const barbersQuery = query(
          collection(db, "barbers"),
          where("ownerId", "==", barberData.uid),
          where("isArchived", "==", false),
          orderBy("name"),
          limit(PUBLIC_QUERY_LIMITS.barbers)
        );
        const barbersSnapshot = await getDocs(barbersQuery);
        if (!isActive) return;
        const barbersList = barbersSnapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((barber) => !barber.isArchived && !barber.archivedAt);

        setBarbers(barbersList);
        setSelectedBarber(barbersList[0] || null);

      } catch (err) {
        if (!isActive) return;
        reportError(err, { source: "public-booking", action: "load-profile" });
        setFatalError("Erro ao carregar os dados da barbearia. Tente novamente mais tarde.");
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadBarberAndServices();

    return () => {
      isActive = false;
    };
  }, [routeSlug]);

  useEffect(() => {
    let isActive = true;

    const loadBookedSlots = async () => {
      if (!barber?.uid || !selectedBarber?.id || !date) {
        setBookedSlots([]);
        setSlotsLoading(false);
        return;
      }

      setSlotsLoading(true);
      setBookedSlots([]);
      setFormError("");

      try {
        const slotsQuery = query(
          collection(db, "bookingSlots"),
          where("userId", "==", barber.uid),
          where("barberId", "==", selectedBarber.id),
          where("date", "==", date),
          orderBy("time"),
          limit(PUBLIC_QUERY_LIMITS.slotsByDay)
        );
        const slotsSnapshot = await getDocs(slotsQuery);
        const slotsList = slotsSnapshot.docs.map((slotDoc) => ({ id: slotDoc.id, ...slotDoc.data() }));
        if (!isActive) return;
        setBookedSlots(slotsList);
      } catch (err) {
        if (!isActive) return;
        reportError(err, { source: "public-booking", action: "load-slots" });
        setFormError("Nao foi possivel carregar os horarios ocupados. Tente trocar a data.");
      } finally {
        if (isActive) setSlotsLoading(false);
      }
    };

    loadBookedSlots();

    return () => {
      isActive = false;
    };
  }, [barber?.uid, selectedBarber?.id, date]);

  const bookAppointment = async () => {
    if (submitLoading) return;

    if (!barber || !barber.uid) {
      setFormError("Dados do barbeiro nao disponiveis. Atualize a pagina e tente novamente.");
      return;
    }

    if (!hasPublishedServices) {
      setFormError("Esta barbearia ainda nao publicou servicos para agendamento online.");
      return;
    }

    if (!selectedBarber) {
      setFormError("Selecione um barbeiro antes de agendar.");
      return;
    }

    const clientInput = normalizeClientInput({ name, phone });
    const validationError = validateClientInput(clientInput);
    const cleanName = clientInput.name;
    const cleanPhone = clientInput.phone;

    if (!selectedService || !date || !time) {
      setFormError("Preencha todos os campos para agendar o seu horario.");
      return;
    }

    if (validationError || !isValidBrazilianPhone(cleanPhone)) {
      setFormError(validationError || "Informe um telefone valido com DDD.");
      return;
    }

    if (!isPrivacyConsentAccepted(privacyAccepted)) {
      setFormError("Aceite o uso dos seus dados para solicitar o agendamento.");
      return;
    }

    if (isBlockedDate) {
      setFormError("Esta data esta indisponivel. Escolha outro dia para agendar.");
      return;
    }

    if (!timeSlots.includes(time)) {
      setFormError("Escolha um horario valido dentro do funcionamento da barbearia.");
      return;
    }

    if (!isFutureAppointmentStart({ date, time })) {
      setFormError("Escolha um horario futuro para agendar.");
      return;
    }

    if (!isDateWithinAppointmentWindow(date, appointmentWindow)) {
      setFormError("Escolha uma data dentro da janela disponivel para agendamento online.");
      return;
    }

    if (!isTimeAvailable(time)) {
      setFormError("Este horario nao esta mais disponivel. Escolha outro horario.");
      return;
    }

    const service = services.find((serviceItem) => serviceItem.id === selectedService);
    if (!service) {
      setFormError("Selecione um servico valido.");
      return;
    }

    setSubmitLoading(true);
    setFormError("");
    const confirmation = createBookingConfirmation({
      clientName: cleanName,
      clientPhone: cleanPhone,
      service,
      barber: selectedBarber,
      date,
      time,
    });

    try {
      const slotId = createSlotId({
        userId: barber.uid,
        barberId: selectedBarber.id,
        date,
        time,
      });
      const appointmentRef = doc(collection(db, "appointments"));
      const clientRef = doc(collection(db, "clients"));
      const phoneKeyRef = doc(
        db,
        "clientPhoneKeys",
        createClientPhoneKeyId({ userId: barber.uid, phone: cleanPhone })
      );
      const createdAt = new Date();
      const startMinutes = timeToMinutes(time);
      const endMinutes = startMinutes + selectedDuration;
      const occupiedTimes = getOccupiedTimes({
        startMinutes,
        endMinutes,
        interval: Number(businessHours.slotInterval) || defaultBusinessHours.slotInterval,
      });
      const slotIds = occupiedTimes.map((occupiedTime) =>
        createSlotId({
          userId: barber.uid,
          barberId: selectedBarber.id,
          date,
          time: occupiedTime,
        })
      );
      const slotRefs = slotIds.map((occupiedSlotId) => doc(db, "bookingSlots", occupiedSlotId));
      let clientRecord = null;
      const newClient = {
        name: cleanName,
        phone: cleanPhone,
        phoneNormalized: cleanPhone,
        createdAt,
        userId: barber.uid,
        barberSlug: routeSlug,
        isArchived: false,
      };
      const appointmentData = {
        clientId: clientRef.id,
        client: createClientSnapshot({
          id: clientRef.id,
          name: cleanName,
          phone: cleanPhone,
        }),
        clientName: cleanName,
        clientPhone: cleanPhone,
        service: createServiceSnapshot(service),
        barberId: selectedBarber.id,
        barberName: selectedBarber.name,
        date,
        time,
        duration: selectedDuration,
        startMinutes,
        endMinutes,
        status: APPOINTMENT_STATUS.pending,
        userId: barber.uid,
        barberSlug: routeSlug,
        slotId,
        slotIds,
        createdAt,
        ...createPrivacyConsentSnapshot({ accepted: privacyAccepted, acceptedAt: createdAt }),
      };

      await runTransaction(db, async (transaction) => {
        const phoneKeySnapshot = await transaction.get(phoneKeyRef);
        if (phoneKeySnapshot.exists()) {
          clientRecord = {
            id: phoneKeySnapshot.data().clientId,
            name: cleanName,
            phone: cleanPhone,
          };
          appointmentData.clientId = clientRecord.id;
          appointmentData.client = createClientSnapshot(clientRecord);
        }

        for (const slotRef of slotRefs) {
          const slotSnapshot = await transaction.get(slotRef);
          if (slotSnapshot.exists()) {
            throw new Error("slot-unavailable");
          }
        }

        slotRefs.forEach((slotRef, index) => {
          transaction.set(slotRef, {
            appointmentId: appointmentRef.id,
            userId: barber.uid,
            barberId: selectedBarber.id,
            barberName: selectedBarber.name,
            date,
            time: occupiedTimes[index],
            rootTime: time,
            duration: selectedDuration,
            startMinutes,
            endMinutes,
            status: APPOINTMENT_STATUS.pending,
            createdAt,
          });
        });

        if (!clientRecord) {
          transaction.set(clientRef, newClient);
          transaction.set(phoneKeyRef, {
            userId: barber.uid,
            phoneNormalized: cleanPhone,
            clientId: clientRef.id,
            barberSlug: routeSlug,
            createdAt,
          });
        }

        transaction.set(appointmentRef, appointmentData);
      });

      setSuccess(true);
      setBookingConfirmation(confirmation);
      setName("");
      setPhone("");
      setSelectedService("");
      setDate("");
      setTime("");
      setPrivacyAccepted(false);

      setBookedSlots((current) => [
        ...current,
        ...slotIds.map((occupiedSlotId, index) => ({
          id: occupiedSlotId,
          appointmentId: appointmentRef.id,
          userId: barber.uid,
          barberId: selectedBarber.id,
          barberName: selectedBarber.name,
          date,
          time: occupiedTimes[index],
          rootTime: time,
          duration: selectedDuration,
          startMinutes,
          endMinutes,
          status: APPOINTMENT_STATUS.pending,
        })),
      ]);
      trackEvent("public_appointment_requested", { source: "public-booking", action: "book-appointment" });
    } catch (err) {
      reportError(err, { source: "public-booking", action: "book-appointment" });
      setFormError(
        err.message === "slot-unavailable"
          ? "Este horario acabou de ser reservado. Escolha outro horario."
          : "Erro ao enviar o agendamento. Tente novamente."
      );
      setBookingConfirmation(null);
    } finally {
      setSubmitLoading(false);
    }
  };

  const brandName = barber?.barbershopName || barber?.displayName || "Barbearia premium";
  const barberName = barber?.displayName || barber?.barbershopName || "Seu barbeiro";
  const brandTagline = barber?.bio || "Agende online o seu proximo corte de forma rapida e elegante.";
  const availabilityLabel = slotsLoading
    ? "Carregando"
    : selectedBarber
    ? `${availableSlots.length} ${availableSlots.length === 1 ? "disponivel" : "disponiveis"}`
    : "Selecione um barbeiro";
  const today = formatLocalDate();
  return (
    <main className="min-h-screen bg-gray-950 px-4 py-5 text-white sm:px-6 sm:py-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 space-y-6">
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-3xl space-y-4">
                <span className="inline-flex rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-2 text-xs uppercase tracking-[0.25em] text-indigo-300 sm:text-sm sm:tracking-[0.35em]">
                  Agendamento online
                </span>
                <div className="space-y-3">
                  <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">{brandName}</h1>
                  <p className="text-base text-gray-400 sm:text-xl">{brandTagline}</p>
                </div>
                <div className="flex flex-wrap gap-3 text-sm text-gray-300">
                  <span className="rounded-full bg-white/5 px-4 py-2">{barberName}</span>
                  {barber?.bio && <span className="rounded-full bg-white/5 px-4 py-2">{barber.bio}</span>}
                </div>
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-950 p-5 text-sm text-gray-300">
                <p className="font-semibold text-white">Agendamento publico</p>
                <p className="mt-4 text-sm leading-6 text-gray-400">
                  Escolha um servico, selecione data e horario e confirme seu agendamento de forma rapida.
                </p>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="rounded-3xl border border-gray-800 bg-gray-900 p-8 text-center text-gray-400 sm:p-10">Carregando...</div>
        ) : fatalError ? (
          <div
            className="rounded-3xl border border-red-600 bg-red-950 p-8 text-center text-red-400 sm:p-10"
            role="alert"
            aria-live="assertive"
          >
            {fatalError}
          </div>
        ) : (
          <div className="grid gap-8 xl:grid-cols-[1.4fr_1fr]">
            <section className="space-y-6">
              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Barbeiros</p>
                    <h2 className="mt-3 text-2xl font-bold">Escolha o barbeiro</h2>
                  </div>
                  <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">{barbers.length} opcoes</span>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  {barbers.length === 0 ? (
                    <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-8 text-center text-gray-400">
                      Nenhum barbeiro disponivel no momento.
                    </div>
                  ) : (
                    barbers.map((barberItem) => {
                      const selected = selectedBarber?.id === barberItem.id;
                      return (
                        <button
                          key={barberItem.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedBarber(barberItem);
                            setTime("");
                            setFormError("");
                            setSuccess(false);
                          }}
                          className={`flex min-h-[112px] flex-col justify-between rounded-3xl border p-4 text-left transition sm:p-5 ${
                            selected
                              ? "border-indigo-500 bg-indigo-500/10 shadow-lg"
                              : "border-gray-800 bg-gray-950 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-start gap-4">
                            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-3xl bg-white/10 text-2xl text-indigo-300">
                              <span>
                                {barberItem.name?.split(" ").map((word) => word[0]).join("")}
                              </span>
                              {barberItem.avatar ? (
                                <img
                                  src={barberItem.avatar}
                                  alt={barberItem.name}
                                  onError={(event) => {
                                    event.currentTarget.style.display = "none";
                                  }}
                                  className="absolute h-14 w-14 rounded-3xl object-cover"
                                />
                              ) : null}
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

              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-8">
                <div className="mb-6 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-gray-500">Servicos</p>
                    <h2 className="mt-3 text-2xl font-bold">Escolha o servico ideal</h2>
                  </div>
                  <span className="rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black">
                    {pluralize(services.length, "servico")}
                  </span>
                </div>

                {services.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-8 text-center text-gray-400">
                    Nao ha servicos publicados ainda. Peca ao barbeiro para cadastrar seus servicos.
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {services.map((service) => {
                      const selected = selectedService === service.id;
                      const duration = formatDuration(getServiceCatalogDuration(service));
                      return (
                        <button
                          key={service.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedService(service.id);
                            setDate("");
                            setTime("");
                            setFormError("");
                            setSuccess(false);
                          }}
                          className={`flex flex-col justify-between rounded-3xl border p-5 text-left transition sm:p-6 ${
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
                            <span className="rounded-full bg-gray-800 px-3 py-1 text-sm text-gray-300">
                              {formatCurrencyBRL(getServiceCatalogPrice(service))}
                            </span>
                            {selected && <span className="rounded-full bg-indigo-500 px-3 py-1 text-sm text-white">Selecionado</span>}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-8">
                <h2 className="text-2xl font-bold">Como funciona</h2>
                <ol className="mt-5 space-y-3 text-gray-400">
                  <li>1. Escolha o servico desejado.</li>
                  <li>2. Informe seus dados de contato.</li>
                  <li>3. Selecione a data.</li>
                  <li>4. Escolha um horario disponivel (em verde).</li>
                  <li>5. Clique em reservar e aguarde a confirmacao.</li>
                </ol>
                <p className="mt-5 text-sm text-gray-500 border-t border-gray-800 pt-5">
                  <span className="text-red-400">Horarios em vermelho</span> ja estao ocupados. Escolha outro horario ou data.
                </p>
              </div>
            </section>

            <section className="rounded-3xl border border-gray-800 bg-gray-900 p-5 shadow-sm sm:p-8">
              <div className="mb-6">
                <h2 className="text-2xl font-bold">Agendar horario</h2>
                <p className="text-gray-400 mt-2">Preencha seus dados para confirmar o seu agendamento.</p>
              </div>

              {success && bookingConfirmation && (
                <div
                  className="mb-6 rounded-3xl border border-emerald-500/70 bg-emerald-950 p-5 text-emerald-100"
                  role="status"
                  aria-live="polite"
                >
                  <p className="text-sm uppercase tracking-[0.25em] text-emerald-300">Solicitacao enviada</p>
                  <h3 className="mt-2 text-xl font-bold text-white">Seu horario esta aguardando confirmacao</h3>
                  <p className="mt-2 text-sm leading-6 text-emerald-100/80">
                    A barbearia recebeu seu pedido e deve confirmar pelo telefone informado. Salve este resumo ate receber o retorno.
                  </p>
                  <div className="mt-5 grid gap-2">
                    {getBookingConfirmationLines(bookingConfirmation).map(([label, value]) => (
                      <div key={label} className="flex items-start justify-between gap-4 rounded-2xl bg-black/20 px-4 py-3 text-sm">
                        <span className="text-emerald-200/80">{label}</span>
                        <span className="max-w-[60%] text-right font-semibold text-white">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 rounded-2xl border border-emerald-400/20 bg-emerald-900/30 p-4 text-sm leading-6 text-emerald-50/90">
                    Proximo passo: aguarde a confirmacao da barbearia. Se precisar alterar o horario, envie uma nova solicitacao ou fale diretamente com a equipe.
                  </div>
                </div>
              )}

              {setupUnavailable && (
                <div
                  className="mb-6 rounded-3xl border border-yellow-500/70 bg-yellow-950/80 p-4 text-sm text-yellow-100"
                  role="status"
                  aria-live="polite"
                >
                  Esta barbearia ainda esta finalizando a configuracao online. Tente novamente mais tarde ou fale
                  diretamente com a equipe.
                </div>
              )}

              {formError && (
                <div
                  className="mb-6 rounded-3xl border border-red-800 bg-red-950/70 p-4 text-sm text-red-100"
                  role="alert"
                  aria-live="assertive"
                >
                  {formError}
                </div>
              )}

              <div className="grid gap-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">Nome</span>
                  <input
                    className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                    autoComplete="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFormError("");
                      setSuccess(false);
                    }}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-gray-300">Telefone com DDD</span>
                  <input
                    className="w-full rounded-3xl border border-gray-800 bg-gray-950 p-4 outline-none transition focus:border-indigo-500"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="(11) 98765-4321"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setFormError("");
                      setSuccess(false);
                    }}
                  />
                </label>
                <label className="flex items-start gap-3 rounded-3xl border border-gray-800 bg-gray-950 p-4 text-sm text-gray-300">
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => {
                      setPrivacyAccepted(event.target.checked);
                      setFormError("");
                      setSuccess(false);
                    }}
                    className="mt-1 h-4 w-4 rounded border-gray-700 bg-gray-900 text-indigo-500"
                  />
                  <span className="leading-6">
                    Autorizo a barbearia a usar meu nome e telefone para solicitar, confirmar e acompanhar este agendamento.
                  </span>
                </label>
                <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4">
                  <p className="text-sm text-gray-400">Servico selecionado</p>
                  <p className="mt-2 text-base font-semibold text-white">
                    {selectedServiceData ? selectedServiceData.name : "Selecione um servico acima"}
                  </p>
                  {selectedServiceData && (
                    <p className="mt-2 text-sm text-gray-400">
                      {formatDuration(selectedDuration)} - {formatCurrencyBRL(getServiceCatalogPrice(selectedServiceData))}
                    </p>
                  )}
                </div>
                <div className="rounded-3xl border border-indigo-500 bg-indigo-500/10 p-4 shadow-lg shadow-indigo-500/10 transition hover:border-indigo-400 hover:bg-indigo-500/15 sm:p-5">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold uppercase tracking-[0.25em] text-indigo-300">
                        2. Escolha a data
                      </p>
                      <p className="mt-2 text-sm text-gray-300 max-w-md">
                        {selectedService
                          ? "Selecione o dia desejado. Os horarios respeitam a duracao do servico."
                          : "Escolha um servico antes da data para o BarberOS calcular os horarios corretamente."}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-2 text-xs uppercase tracking-[0.3em] text-white">
                      <span>Data</span>
                    </div>
                  </div>
                  <div className="mt-5 rounded-3xl border border-gray-800 bg-gray-950 p-4 transition hover:border-white/20 focus-within:border-white/20">
                    <label className="block">
                      <span className="sr-only">Data do agendamento</span>
                      <input
                        className="w-full cursor-pointer rounded-3xl border border-transparent bg-transparent px-3 py-4 text-white outline-none transition placeholder:text-gray-500 focus:border-indigo-400 focus:bg-gray-900 focus:ring-2 focus:ring-indigo-500/20"
                        type="date"
                        min={today}
                        max={appointmentWindow.endDate}
                        value={date}
                        disabled={!selectedService}
                        onChange={(e) => {
                          setDate(e.target.value);
                          setTime("");
                          setFormError("");
                          setSuccess(false);
                        }}
                      />
                    </label>
                  </div>
                  {!date && (
                    <p className="mt-4 text-sm text-gray-400">
                      {selectedService ? "Escolha uma data para ver os horarios disponiveis." : "Primeiro escolha um servico acima."}
                    </p>
                  )}
                </div>
                {date && (
                  <div className="rounded-3xl border border-gray-800 bg-gray-950 p-4">
                    <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm uppercase tracking-[0.25em] text-gray-500">3. Escolha o horario</p>
                        <p className="mt-2 text-base text-white">Horarios disponiveis para {new Date(date).toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className="rounded-full bg-gray-900 px-3 py-1 text-xs uppercase tracking-[0.2em] text-gray-400">
                        {availabilityLabel}
                      </span>
                    </div>

                    {isBlockedDate ? (
                      <div className="rounded-3xl border border-dashed border-yellow-500 bg-yellow-950 p-5 text-sm text-yellow-200">
                        <p className="font-semibold">Data indisponivel</p>
                        <p className="mt-2 text-gray-300">
                          Esta data foi bloqueada pela barbearia. Escolha outro dia para agendar.
                        </p>
                      </div>
                    ) : !selectedBarber ? (
                      <div className="rounded-3xl border border-dashed border-gray-700 bg-gray-950 p-5 text-sm text-gray-300">
                        Selecione um barbeiro primeiro para ver os horarios disponiveis.
                      </div>
                    ) : slotsLoading ? (
                      <div className="rounded-3xl border border-dashed border-indigo-500/50 bg-indigo-950/40 p-5 text-sm text-indigo-100">
                        <p className="font-semibold">Carregando horarios</p>
                        <p className="mt-2 text-gray-300">
                          Estamos atualizando a disponibilidade para esta data antes de liberar a solicitacao.
                        </p>
                      </div>
                    ) : availableSlots.length > 0 ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
                        {timeSlots.map((slot) => {
                          const isAvailable = isTimeAvailable(slot);
                          const isSelected = time === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              aria-pressed={isSelected}
                              onClick={() => {
                                if (!isAvailable) return;
                                setTime(slot);
                                setFormError("");
                                setSuccess(false);
                              }}
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
                        <p className="font-semibold">Sem horarios disponiveis</p>
                        <p className="mt-2 text-gray-300">
                          Nao ha horarios livres neste dia. Escolha outra data ou volte ao servico para alterar a selecao.
                        </p>
                      </div>
                    )}

                    {bookedTimes.length > 0 && availableSlots.length > 0 && (
                      <p className="text-xs text-gray-400 mt-3">
                        {pluralize(bookedTimes.length, "horario")} ja{" "}
                        {bookedTimes.length === 1 ? "ocupado" : "ocupados"} nesta data.
                      </p>
                    )}
                  </div>
                )}

                <button type="button"
                  className={`w-full rounded-3xl py-4 text-sm font-semibold transition ${
                    canSubmit
                      ? "bg-white text-black hover:bg-gray-200"
                      : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  }`}
                  onClick={bookAppointment}
                  disabled={!canSubmit}
                  aria-busy={submitLoading ? "true" : "false"}
                >
                  {submitLoading ? "Enviando..." : slotsLoading ? "Atualizando horarios..." : "Solicitar agendamento"}
                </button>
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}
