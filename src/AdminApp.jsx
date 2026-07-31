import { Suspense, lazy, useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import { collection, addDoc, query, where, orderBy, doc, updateDoc, runTransaction, onSnapshot, getDocs, limit, deleteField } from "firebase/firestore";
import { db } from "./services/firebase";
import { useAuth } from "./hooks/useAuth";
import { isAccountActive } from "./utils/trial";
import {
  createClientPhoneKeyId,
  normalizePhone,
  sortAppointments,
  sortByCreatedAtDesc,
  sortByName,
} from "./utils/adminData";
import { createAppointmentDateWindow, isDateWithinAppointmentWindow } from "./utils/appointmentWindow";
import { createWhatsAppUrl } from "./utils/phone";
import {
  ACTIVE_APPOINTMENT_STATUSES,
  APPOINTMENT_STATUS,
  isActiveAppointment,
  isCompletedAppointment,
  isTerminalAppointment,
} from "./utils/appointments";
import {
  createSlotId,
  getOccupiedTimes,
  getSlotInterval,
  isFutureAppointmentStart,
  isValidAppointmentTime,
  timeToMinutes,
} from "./utils/schedule";
import { normalizeServiceInput, validateServiceInput } from "./utils/services";
import { reportError, trackEvent } from "./utils/telemetry";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Clients = lazy(() => import("./pages/Clients"));
const Services = lazy(() => import("./pages/Services"));
const Finance = lazy(() => import("./pages/Finance"));
const Barbers = lazy(() => import("./pages/Barbers"));
const Schedule = lazy(() => import("./pages/Schedule"));
const WhatsApp = lazy(() => import("./pages/WhatsApp"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const ProfileSettings = lazy(() => import("./pages/ProfileSettings"));
const TrialExpired = lazy(() => import("./pages/TrialExpired"));

const ADMIN_QUERY_LIMITS = {
  clients: 1000,
  services: 300,
  barbers: 100,
  appointments: 700,
};

const VALID_APPOINTMENT_STATUSES = new Set(Object.values(APPOINTMENT_STATUS));

const limitWarnings = {
  clients: "Limite de clientes carregados atingido. Use busca/paginacao antes de operar bases maiores.",
  services: "Limite de servicos carregados atingido. Revise o catalogo antes de cadastrar muitos itens.",
  barbers: "Limite de barbeiros carregados atingido. Revise a estrutura de equipe antes de expandir.",
  appointments: "Limite de agendamentos da janela operacional atingido. Use filtros por periodo antes de operar uma agenda maior.",
};

function RouteLoading() {
  return (
    <div className="flex min-h-screen flex-1 items-center justify-center bg-gray-950 p-6 text-white">
      <div className="rounded-2xl border border-gray-800 bg-gray-900 px-5 py-4 text-sm text-gray-300">
        Carregando...
      </div>
    </div>
  );
}

function ProtectedRoute({ children, user, profile, authLoading, profileLoading }) {
  if (authLoading || profileLoading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user && !profile) return <Navigate to="/setup-profile" replace />;
  if (user && profile && !profile.profileComplete) return <Navigate to="/setup-profile" replace />;
  if (user && profile && !isAccountActive(profile)) return <TrialExpired />;
  return children;
}

function SetupRoute({ children, user, profile, authLoading, profileLoading }) {
  if (authLoading || profileLoading) return <RouteLoading />;
  if (!user) return <Navigate to="/login" replace />;
  if (user && profile && profile.profileComplete) return <Navigate to="/dashboard" replace />;
  return children;
}

function LoginWrapper({ user, profile, authLoading, profileLoading }) {
  if (authLoading || profileLoading) return <RouteLoading />;
  if (user) return <Navigate to={profile?.profileComplete ? "/dashboard" : "/setup-profile"} replace />;
  return <Login />;
}

function RegisterWrapper({ user, profile, authLoading, profileLoading }) {
  if (authLoading || profileLoading) return <RouteLoading />;
  if (user) return <Navigate to={profile?.profileComplete ? "/dashboard" : "/setup-profile"} replace />;
  return <Register />;
}

export default function AdminApp() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const [clients, setClients] = useState([]);
  const [archivedClients, setArchivedClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [archivedServices, setArchivedServices] = useState([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [barbers, setBarbers] = useState([]);
  const [archivedBarbers, setArchivedBarbers] = useState([]);
  const [barbersLoading, setBarbersLoading] = useState(true);
  const [appointments, setAppointments] = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLogsLoading, setAuditLogsLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [dataWarnings, setDataWarnings] = useState({});
  const [notification, setNotification] = useState(null);
  const appointmentWindow = useMemo(() => createAppointmentDateWindow(), []);

  

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");

  const notify = (message, type = "error") => {
    setNotification({ message, type });
    window.setTimeout(() => {
      setNotification((current) => (current?.message === message ? null : current));
    }, 4000);
  };

  const updateLimitWarning = useCallback((key, snapshotSize) => {
    setDataWarnings((currentWarnings) => {
      const reachedLimit = snapshotSize >= ADMIN_QUERY_LIMITS[key];
      if (reachedLimit) {
        return { ...currentWarnings, [key]: limitWarnings[key] };
      }

      if (!currentWarnings[key]) return currentWarnings;
      const nextWarnings = { ...currentWarnings };
      delete nextWarnings[key];
      return nextWarnings;
    });
  }, []);
  const recordAuditLog = useCallback(
    async ({ action, entityType, entityId, entityLabel = "", summary = "", source = "admin" }) => {
      if (!user || !action || !entityType || !entityId) return;

      try {
        await addDoc(collection(db, "auditLogs"), {
          userId: user.uid,
          actorId: user.uid,
          action: String(action).slice(0, 80),
          entityType: String(entityType).slice(0, 40),
          entityId: String(entityId).slice(0, 128),
          entityLabel: String(entityLabel || "").slice(0, 120),
          summary: String(summary || "").slice(0, 160),
          source: String(source || "admin").slice(0, 40),
          createdAt: new Date(),
        });
      } catch (error) {
        reportError(error, { source: "admin", action: "write-audit-log" });
      }
    },
    [user]
  );

  const hasActiveAppointmentByField = useCallback(
    async (fieldName, value) => {
      if (!user || !value) return false;

      const activeAppointmentQuery = query(
        collection(db, "appointments"),
        where("userId", "==", user.uid),
        where(fieldName, "==", value),
        where("status", "in", ACTIVE_APPOINTMENT_STATUSES),
        limit(1)
      );
      const activeAppointmentSnapshot = await getDocs(activeAppointmentQuery);
      return !activeAppointmentSnapshot.empty;
    },
    [user]
  );


  // Load clients, services, and appointments from Firestore when user is available
  useEffect(() => {
    if (!user) {
      setClients([]);
      setArchivedClients([]);
      setClientsLoading(false);
      setServices([]);
      setArchivedServices([]);
      setServicesLoading(false);
      setBarbers([]);
      setArchivedBarbers([]);
      setBarbersLoading(false);
      setAppointments([]);
      setAppointmentsLoading(false);
      setAuditLogs([]);
      setAuditLogsLoading(false);
      setDataError("");
      setDataWarnings({});
      return;
    }

    setClientsLoading(true);
    setServicesLoading(true);
    setBarbersLoading(true);
    setAppointmentsLoading(true);
    setAuditLogsLoading(true);

    const clientsQuery = query(
      collection(db, "clients"),
      where("userId", "==", user.uid),
      orderBy("name"),
      limit(ADMIN_QUERY_LIMITS.clients)
    );
    const servicesQuery = query(
      collection(db, "services"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(ADMIN_QUERY_LIMITS.services)
    );
    const barbersQuery = query(
      collection(db, "barbers"),
      where("ownerId", "==", user.uid),
      orderBy("name"),
      limit(ADMIN_QUERY_LIMITS.barbers)
    );
    const appointmentsQuery = query(
      collection(db, "appointments"),
      where("userId", "==", user.uid),
      where("date", ">=", appointmentWindow.startDate),
      where("date", "<=", appointmentWindow.endDate),
      orderBy("date"),
      orderBy("time"),
      limit(ADMIN_QUERY_LIMITS.appointments)
    );
    const auditLogsQuery = query(
      collection(db, "auditLogs"),
      where("userId", "==", user.uid),
      orderBy("createdAt", "desc"),
      limit(ADMIN_QUERY_LIMITS.auditLogs)
    );


    const unsubscribeClients = onSnapshot(
      clientsQuery,
      (clientsSnapshot) => {
        const allClients = clientsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClients(sortByName(allClients.filter((client) => !client.isArchived && !client.archivedAt)));
        setArchivedClients(sortByName(allClients.filter((client) => client.isArchived || client.archivedAt)));
        updateLimitWarning("clients", clientsSnapshot.size);
        setClientsLoading(false);
        setDataError("");
      },
      (error) => {
        reportError(error, { source: "admin", action: "watch-clients" });
        setDataError("Nao foi possivel sincronizar clientes. Recarregue a pagina ou tente novamente em instantes.");
        setClientsLoading(false);
      }
    );

    const unsubscribeServices = onSnapshot(
      servicesQuery,
      (servicesSnapshot) => {
        const allServices = servicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setServices(sortByCreatedAtDesc(allServices.filter((service) => !service.isArchived && !service.archivedAt)));
        setArchivedServices(sortByCreatedAtDesc(allServices.filter((service) => service.isArchived || service.archivedAt)));
        updateLimitWarning("services", servicesSnapshot.size);
        setServicesLoading(false);
        setDataError("");
      },
      (error) => {
        reportError(error, { source: "admin", action: "watch-services" });
        setServicesLoading(false);
        setDataError("Nao foi possivel sincronizar servicos. Recarregue a pagina ou tente novamente em instantes.");
      }
    );

    const unsubscribeBarbers = onSnapshot(
      barbersQuery,
      (barbersSnapshot) => {
        const allBarbers = barbersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setBarbers(sortByName(allBarbers.filter((barber) => !barber.isArchived && !barber.archivedAt)));
        setArchivedBarbers(sortByName(allBarbers.filter((barber) => barber.isArchived || barber.archivedAt)));
        updateLimitWarning("barbers", barbersSnapshot.size);
        setBarbersLoading(false);
        setDataError("");
      },
      (error) => {
        reportError(error, { source: "admin", action: "watch-barbers" });
        setBarbersLoading(false);
        setDataError("Nao foi possivel sincronizar a equipe. Recarregue a pagina ou tente novamente em instantes.");
      }
    );

    const unsubscribeAppointments = onSnapshot(
      appointmentsQuery,
      (appointmentsSnapshot) => {
        const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAppointments(sortAppointments(appointmentsList));
        updateLimitWarning("appointments", appointmentsSnapshot.size);
        setAppointmentsLoading(false);
        setDataError("");
      },
      (error) => {
        reportError(error, { source: "admin", action: "watch-appointments" });
        setAppointmentsLoading(false);
        setDataError("Nao foi possivel sincronizar a agenda. Recarregue a pagina ou tente novamente em instantes.");
      }
    );


    const unsubscribeAuditLogs = onSnapshot(
      auditLogsQuery,
      (auditLogsSnapshot) => {
        const auditLogsList = auditLogsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAuditLogs(auditLogsList);
        updateLimitWarning("auditLogs", auditLogsSnapshot.size);
        setAuditLogsLoading(false);
        setDataError("");
      },
      (error) => {
        reportError(error, { source: "admin", action: "watch-audit-logs" });
        setAuditLogsLoading(false);
        setDataError("Nao foi possivel sincronizar atividades recentes. Recarregue a pagina ou tente novamente em instantes.");
      }
    );

    return () => {
      unsubscribeClients();
      unsubscribeServices();
      unsubscribeBarbers();
      unsubscribeAppointments();
      unsubscribeAuditLogs();
    };
  }, [user, updateLimitWarning, appointmentWindow.startDate, appointmentWindow.endDate]);

  const addClient = async (name, phone) => {
    const cleanName = String(name || "").trim();
    const cleanPhone = normalizePhone(phone);

    if (!user) {
      notify("Sessao expirada. Entre novamente para cadastrar clientes.");
      return false;
    }

    if (!cleanName || cleanPhone.length < 10) {
      notify("Preencha nome e telefone do cliente");
      return false;
    }

    const phoneAlreadyExists = clients.some(
      (client) => normalizePhone(client.phoneNormalized || client.phone) === cleanPhone
    );

    if (phoneAlreadyExists) {
      notify("Ja existe um cliente cadastrado com este telefone.");
      return false;
    }

    try {
      const clientRef = doc(collection(db, "clients"));
      const phoneKeyRef = doc(
        db,
        "clientPhoneKeys",
        createClientPhoneKeyId({ userId: user.uid, phone: cleanPhone })
      );
      const newClient = {
        name: cleanName,
        phone: cleanPhone,
        phoneNormalized: cleanPhone,
        createdAt: new Date(),
        userId: user.uid,
        isArchived: false,
      };

      await runTransaction(db, async (transaction) => {
        const phoneKeySnapshot = await transaction.get(phoneKeyRef);
        if (phoneKeySnapshot.exists()) {
          throw new Error("client-phone-duplicate");
        }

        transaction.set(clientRef, newClient);
        transaction.set(phoneKeyRef, {
          userId: user.uid,
          phoneNormalized: cleanPhone,
          clientId: clientRef.id,
          createdAt: newClient.createdAt,
        });
      });

      const clientWithId = { id: clientRef.id, ...newClient };
      setClients((prevClients) => [...prevClients, clientWithId]);
      trackEvent("client_created", { source: "admin", action: "add-client" });
      await recordAuditLog({
        action: "client_created",
        entityType: "client",
        entityId: clientRef.id,
        entityLabel: cleanName,
        summary: "Cliente cadastrado na base ativa.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "add-client" });
      notify(
        error.message === "client-phone-duplicate"
          ? "Ja existe um cliente cadastrado com este telefone."
          : "Erro ao adicionar cliente. Tente novamente."
      );
      return false;
    }
  };

  const updateClient = async (clientId, updates) => {
    const cleanName = String(updates.name || "").trim();
    const cleanPhone = normalizePhone(updates.phone);
    const currentClient = clients.find((client) => client.id === clientId);

    if (!user || !currentClient) {
      notify("Cliente nao encontrado.");
      return false;
    }

    if (!cleanName || cleanPhone.length < 10) {
      notify("Preencha nome e telefone com DDD.");
      return false;
    }

    const duplicateClient = clients.find(
      (client) =>
        client.id !== clientId &&
        normalizePhone(client.phoneNormalized || client.phone) === cleanPhone
    );

    if (duplicateClient) {
      notify("Ja existe outro cliente com este telefone.");
      return false;
    }

    const previousClients = clients;
    const previousPhone = normalizePhone(currentClient.phoneNormalized || currentClient.phone);
    const nextClient = {
      ...currentClient,
      name: cleanName,
      phone: cleanPhone,
      phoneNormalized: cleanPhone,
      updatedAt: new Date(),
    };

    setClients((currentClients) =>
      currentClients.map((client) => (client.id === clientId ? nextClient : client))
    );

    try {
      const clientRef = doc(db, "clients", clientId);
      const nextPhoneKeyRef = doc(
        db,
        "clientPhoneKeys",
        createClientPhoneKeyId({ userId: user.uid, phone: cleanPhone })
      );
      const previousPhoneKeyRef = previousPhone
        ? doc(
            db,
            "clientPhoneKeys",
            createClientPhoneKeyId({ userId: user.uid, phone: previousPhone })
          )
        : null;

      await runTransaction(db, async (transaction) => {
        if (previousPhone !== cleanPhone) {
          const nextPhoneKeySnapshot = await transaction.get(nextPhoneKeyRef);
          if (nextPhoneKeySnapshot.exists()) {
            throw new Error("client-phone-duplicate");
          }
        }

        transaction.update(clientRef, {
          name: cleanName,
          phone: cleanPhone,
          phoneNormalized: cleanPhone,
          updatedAt: nextClient.updatedAt,
        });

        if (previousPhone !== cleanPhone) {
          if (previousPhoneKeyRef) transaction.delete(previousPhoneKeyRef);
          transaction.set(nextPhoneKeyRef, {
            userId: user.uid,
            phoneNormalized: cleanPhone,
            clientId,
            createdAt: nextClient.updatedAt,
          });
        }
      });

      await recordAuditLog({
        action: "client_updated",
        entityType: "client",
        entityId: clientId,
        entityLabel: cleanName,
        summary: previousPhone !== cleanPhone ? "Cliente atualizado com troca de telefone." : "Cliente atualizado.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "update-client" });
      setClients(previousClients);
      notify(
        error.message === "client-phone-duplicate"
          ? "Ja existe outro cliente com este telefone."
          : "Erro ao atualizar cliente. Tente novamente."
      );
      return false;
    }
  };

  const deleteClient = async (clientId) => {
    const currentClient = clients.find((client) => client.id === clientId);
    if (!user || !currentClient) {
      notify("Cliente nao encontrado.");
      return false;
    }

    const hasActiveAppointmentsInView = appointments.some((appointment) => {
      const appointmentClientId = appointment.clientId || appointment.client?.id;
      return String(appointmentClientId) === String(clientId) && isActiveAppointment(appointment);
    });

    if (hasActiveAppointmentsInView) {
      notify("Este cliente tem agendamento ativo. Cancele ou conclua o horario antes de arquivar.");
      return false;
    }

    try {
      const hasActiveAppointments = await hasActiveAppointmentByField("clientId", clientId);
      if (hasActiveAppointments) {
        notify("Este cliente tem agendamento ativo fora da tela atual. Cancele ou conclua antes de arquivar.");
        return false;
      }
    } catch (error) {
      reportError(error, { source: "admin", action: "check-client-active-appointments" });
      notify("Nao foi possivel verificar agendamentos ativos deste cliente. Tente novamente.");
      return false;
    }
    const previousClients = clients;
    setClients((currentClients) => currentClients.filter((client) => client.id !== clientId));

    try {
      const cleanPhone = normalizePhone(currentClient.phoneNormalized || currentClient.phone);
      const archivedAt = new Date();
      await runTransaction(db, async (transaction) => {
        transaction.update(doc(db, "clients", clientId), {
          isArchived: true,
          archivedAt,
          updatedAt: archivedAt,
        });
        if (cleanPhone) {
          transaction.delete(
            doc(
              db,
              "clientPhoneKeys",
              createClientPhoneKeyId({ userId: user.uid, phone: cleanPhone })
            )
          );
        }
      });
      trackEvent("client_archived", { source: "admin", action: "archive-client" });
      await recordAuditLog({
        action: "client_archived",
        entityType: "client",
        entityId: clientId,
        entityLabel: currentClient.name,
        summary: "Cliente arquivado da base ativa.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "archive-client" });
      setClients(previousClients);
      notify("Erro ao arquivar cliente. Tente novamente.");
      return false;
    }
  };

  const addService = async (name, price, duration = 30) => {
    const serviceInput = normalizeServiceInput({ name, price, duration });
    const validationError = validateServiceInput(serviceInput);

    if (!user) {
      notify("Sessao expirada. Entre novamente para cadastrar servicos.");
      return false;
    }

    if (validationError) {
      notify(validationError);
      return false;
    }

    try {
      const newService = {
        name: serviceInput.name,
        price: serviceInput.price,
        duration: serviceInput.duration,
        createdAt: new Date(),
        userId: user.uid,
        isArchived: false,
      };

      const docRef = await addDoc(collection(db, "services"), newService);
      const serviceWithId = { id: docRef.id, ...newService };
      setServices((prev) => [...prev, serviceWithId]);
      trackEvent("service_created", { source: "admin", action: "add-service" });
      await recordAuditLog({
        action: "service_created",
        entityType: "service",
        entityId: docRef.id,
        entityLabel: serviceInput.name,
        summary: "Servico cadastrado no catalogo ativo.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "add-service" });
      notify("Erro ao adicionar servico. Tente novamente.");
      return false;
    }
  };

  const updateService = async (serviceId, updates) => {
    const serviceInput = normalizeServiceInput(updates);
    const validationError = validateServiceInput(serviceInput);

    if (validationError) {
      notify(validationError);
      return false;
    }

    const nextUpdates = {
      name: serviceInput.name,
      price: serviceInput.price,
      duration: serviceInput.duration,
      updatedAt: new Date(),
    };

    try {
      const serviceRef = doc(db, "services", serviceId);
      await updateDoc(serviceRef, nextUpdates);
      setServices((prev) =>
        prev.map((service) => (service.id === serviceId ? { ...service, ...nextUpdates } : service))
      );
      trackEvent("service_updated", { source: "admin", action: "update-service" });
      await recordAuditLog({
        action: "service_updated",
        entityType: "service",
        entityId: serviceId,
        entityLabel: serviceInput.name,
        summary: "Servico atualizado no catalogo.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "update-service" });
      notify("Erro ao atualizar servico. Tente novamente.");
      return false;
    }
  };

  const deleteService = async (serviceId) => {
    const hasActiveAppointmentInView = appointments.some((appointment) => {
      const serviceIdFromAppointment = appointment.service?.id || appointment.serviceId;
      return String(serviceIdFromAppointment) === String(serviceId) && isActiveAppointment(appointment);
    });

    if (hasActiveAppointmentInView) {
      notify("Este servico tem agendamento ativo. Cancele ou conclua os horarios antes de arquivar.");
      return false;
    }

    try {
      const hasActiveAppointment = await hasActiveAppointmentByField("service.id", serviceId);
      if (hasActiveAppointment) {
        notify("Este servico tem agendamento ativo fora da tela atual. Cancele ou conclua antes de arquivar.");
        return false;
      }
    } catch (error) {
      reportError(error, { source: "admin", action: "check-service-active-appointments" });
      notify("Nao foi possivel verificar agendamentos ativos deste servico. Tente novamente.");
      return false;
    }
    try {
      const archivedAt = new Date();
      const serviceRef = doc(db, "services", serviceId);
      await updateDoc(serviceRef, { isArchived: true, archivedAt, updatedAt: archivedAt });
      setServices((prev) => prev.filter((service) => service.id !== serviceId));
      trackEvent("service_archived", { source: "admin", action: "archive-service" });
      await recordAuditLog({
        action: "service_archived",
        entityType: "service",
        entityId: serviceId,
        entityLabel: services.find((service) => service.id === serviceId)?.name || "Servico",
        summary: "Servico arquivado do catalogo ativo.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "archive-service" });
      notify("Erro ao arquivar servico. Tente novamente.");
      return false;
    }
  };
  const restoreClient = async (clientId) => {
    const archivedClient = archivedClients.find((client) => client.id === clientId);
    if (!user || !archivedClient) {
      notify("Cliente arquivado nao encontrado.");
      return false;
    }

    const cleanPhone = normalizePhone(archivedClient.phoneNormalized || archivedClient.phone);
    if (!cleanPhone) {
      notify("Cliente sem telefone valido nao pode ser restaurado.");
      return false;
    }

    const previousClients = clients;
    const previousArchivedClients = archivedClients;
    const restoredAt = new Date();
    const restoredClient = {
      ...archivedClient,
      isArchived: false,
      archivedAt: undefined,
      updatedAt: restoredAt,
    };

    setArchivedClients((currentClients) => currentClients.filter((client) => client.id !== clientId));
    setClients((currentClients) => sortByName([...currentClients, restoredClient]));

    try {
      const clientRef = doc(db, "clients", clientId);
      const phoneKeyRef = doc(
        db,
        "clientPhoneKeys",
        createClientPhoneKeyId({ userId: user.uid, phone: cleanPhone })
      );

      await runTransaction(db, async (transaction) => {
        const phoneKeySnapshot = await transaction.get(phoneKeyRef);
        if (phoneKeySnapshot.exists()) {
          throw new Error("client-phone-duplicate");
        }

        transaction.update(clientRef, {
          isArchived: false,
          archivedAt: deleteField(),
          updatedAt: restoredAt,
        });
        transaction.set(phoneKeyRef, {
          userId: user.uid,
          phoneNormalized: cleanPhone,
          clientId,
          createdAt: restoredAt,
        });
      });

      trackEvent("client_restored", { source: "admin", action: "restore-client" });
      await recordAuditLog({
        action: "client_restored",
        entityType: "client",
        entityId: clientId,
        entityLabel: archivedClient.name,
        summary: "Cliente restaurado para a base ativa.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "restore-client" });
      setClients(previousClients);
      setArchivedClients(previousArchivedClients);
      notify(
        error.message === "client-phone-duplicate"
          ? "Ja existe um cliente ativo com este telefone. Ajuste o cadastro antes de restaurar."
          : "Erro ao restaurar cliente. Tente novamente."
      );
      return false;
    }
  };

  const restoreService = async (serviceId) => {
    const archivedService = archivedServices.find((service) => service.id === serviceId);
    if (!archivedService) {
      notify("Servico arquivado nao encontrado.");
      return false;
    }

    const previousServices = services;
    const previousArchivedServices = archivedServices;
    const restoredAt = new Date();
    const restoredService = {
      ...archivedService,
      isArchived: false,
      archivedAt: undefined,
      updatedAt: restoredAt,
    };

    setArchivedServices((currentServices) => currentServices.filter((service) => service.id !== serviceId));
    setServices((currentServices) => sortByCreatedAtDesc([...currentServices, restoredService]));

    try {
      await updateDoc(doc(db, "services", serviceId), {
        isArchived: false,
        archivedAt: deleteField(),
        updatedAt: restoredAt,
      });
      trackEvent("service_restored", { source: "admin", action: "restore-service" });
      await recordAuditLog({
        action: "service_restored",
        entityType: "service",
        entityId: serviceId,
        entityLabel: archivedService.name,
        summary: "Servico restaurado para o catalogo ativo.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "restore-service" });
      setServices(previousServices);
      setArchivedServices(previousArchivedServices);
      notify("Erro ao restaurar servico. Tente novamente.");
      return false;
    }
  };

  const restoreBarber = async (barberId) => {
    const archivedBarber = archivedBarbers.find((barber) => barber.id === barberId);
    if (!archivedBarber) {
      notify("Barbeiro arquivado nao encontrado.");
      return false;
    }

    const previousBarbers = barbers;
    const previousArchivedBarbers = archivedBarbers;
    const restoredAt = new Date();
    const restoredBarber = {
      ...archivedBarber,
      isArchived: false,
      archivedAt: undefined,
      updatedAt: restoredAt,
    };

    setArchivedBarbers((currentBarbers) => currentBarbers.filter((barber) => barber.id !== barberId));
    setBarbers((currentBarbers) => sortByName([...currentBarbers, restoredBarber]));

    try {
      await updateDoc(doc(db, "barbers", barberId), {
        isArchived: false,
        archivedAt: deleteField(),
        updatedAt: restoredAt,
      });
      trackEvent("barber_restored", { source: "admin", action: "restore-barber" });
      await recordAuditLog({
        action: "barber_restored",
        entityType: "barber",
        entityId: barberId,
        entityLabel: archivedBarber.name,
        summary: "Barbeiro restaurado para a equipe ativa.",
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "restore-barber" });
      setBarbers(previousBarbers);
      setArchivedBarbers(previousArchivedBarbers);
      notify("Erro ao restaurar barbeiro. Tente novamente.");
      return false;
    }
  };

  const addAppointment = async () => {
    if (!selectedClient || !selectedService || !selectedBarber || !appointmentDate || !appointmentTime) {
      notify("Preencha todos os dados do agendamento");
      return;
    }

    try {
      const client = clients.find((client) => String(client.id) === String(selectedClient));
      const service = services.find((service) => String(service.id) === String(selectedService));
      const barber = barberOptions.find((barberItem) => String(barberItem.id) === String(selectedBarber));

      if (!client || !service || !barber || !user) {
        notify("Dados do agendamento invalidos. Atualize a pagina e tente novamente.");
        return;
      }

      const createdAt = new Date();
      const duration = Number(service?.duration) || 30;
      const startMinutes = timeToMinutes(appointmentTime);
      const endMinutes = startMinutes + duration;
      if (
        !isValidAppointmentTime({
          date: appointmentDate,
          time: appointmentTime,
          duration,
          businessHours: profile?.businessHours,
        })
      ) {
        notify("Escolha um horario dentro do funcionamento configurado e em uma data futura.");
        return;
      }

      if (!isFutureAppointmentStart({ date: appointmentDate, time: appointmentTime })) {
        notify("Escolha um horario futuro para criar o agendamento.");
        return;
      }

      if (!isDateWithinAppointmentWindow(appointmentDate, appointmentWindow)) {
        notify("Escolha uma data dentro da janela operacional da agenda.");
        return;
      }

      const occupiedTimes = getOccupiedTimes({
        startMinutes,
        endMinutes,
        interval: getSlotInterval(profile),
      });
      const newAppointment = {
        clientId: client.id,
        client,
        clientName: client.name,
        clientPhone: client.phone,
        service,
        barberId: barber.id,
        barberName: barber.name,
        date: appointmentDate,
        time: appointmentTime,
        duration,
        startMinutes,
        endMinutes,
        status: APPOINTMENT_STATUS.pending,
        createdAt,
        userId: user.uid,
      };

      const appointmentRef = doc(collection(db, "appointments"));
      const slotId = createSlotId({
        userId: user.uid,
        barberId: barber.id,
        date: appointmentDate,
        time: appointmentTime,
      });
      newAppointment.slotId = slotId;
      const slotIds = occupiedTimes.map((occupiedTime) =>
        createSlotId({
          userId: user.uid,
          barberId: barber.id,
          date: appointmentDate,
          time: occupiedTime,
        })
      );
      newAppointment.slotIds = slotIds;
      const slotRefs = slotIds.map((occupiedSlotId) => doc(db, "bookingSlots", occupiedSlotId));

      await runTransaction(db, async (transaction) => {
        for (const slotRef of slotRefs) {
          const slotSnapshot = await transaction.get(slotRef);
          if (slotSnapshot.exists()) {
            throw new Error("slot-unavailable");
          }
        }

        slotRefs.forEach((slotRef, index) => {
          transaction.set(slotRef, {
            appointmentId: appointmentRef.id,
            userId: user.uid,
            barberId: barber.id,
            barberName: barber.name,
            date: appointmentDate,
            time: occupiedTimes[index],
            rootTime: appointmentTime,
            duration,
            startMinutes,
            endMinutes,
            status: APPOINTMENT_STATUS.pending,
            createdAt,
          });
        });
        transaction.set(appointmentRef, newAppointment);
      });

      const appointmentWithId = { id: appointmentRef.id, ...newAppointment };

      setAppointments([...appointments, appointmentWithId]);
      setSelectedClient("");
      setSelectedService("");
      setSelectedBarber("");
      setAppointmentDate("");
      setAppointmentTime("");
      trackEvent("appointment_created", { source: "admin", action: "add-appointment" });
      await recordAuditLog({
        action: "appointment_created",
        entityType: "appointment",
        entityId: appointmentRef.id,
        entityLabel: client.name,
        summary: `Agendamento criado para ${appointmentDate} as ${appointmentTime}.`,
      });
    } catch (error) {
      reportError(error, { source: "admin", action: "add-appointment" });
      notify(
        error.message === "slot-unavailable"
          ? "Este horario ja esta reservado. Escolha outro horario."
          : "Erro ao adicionar agendamento. Tente novamente."
      );
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    const previousAppointments = appointments;
    const appointment = appointments.find((apt) => apt.id === appointmentId);

    if (!appointment) {
      notify("Agendamento nao encontrado.");
      return false;
    }

    if (!VALID_APPOINTMENT_STATUSES.has(newStatus)) {
      notify("Status de agendamento invalido.");
      return false;
    }

    if (isTerminalAppointment(appointment)) {
      notify("Agendamentos concluidos ou cancelados nao podem ser reativados pelo painel.");
      return false;
    }

    setAppointments((currentAppointments) =>
      currentAppointments.map((apt) =>
        apt.id === appointmentId ? { ...apt, status: newStatus } : apt
      )
    );

    try {
      const appointmentRef = doc(db, "appointments", appointmentId);
      const slotIds =
        appointment?.slotIds ||
        (appointment?.userId && appointment?.barberId && appointment?.date && appointment?.time
          ? [
              createSlotId({
                userId: appointment.userId,
                barberId: appointment.barberId,
                date: appointment.date,
                time: appointment.time,
              }),
            ]
          : []);
      const slotRefs = slotIds.map((slotId) => doc(db, "bookingSlots", slotId));
      const updatedAt = new Date();

      await runTransaction(db, async (transaction) => {
        transaction.update(appointmentRef, { status: newStatus, updatedAt });

        slotRefs.forEach((slotRef) => {
          if (newStatus === APPOINTMENT_STATUS.cancelled) {
            transaction.delete(slotRef);
          } else {
            transaction.update(slotRef, { status: newStatus, updatedAt });
          }
        });
      });
      trackEvent("appointment_status_updated", { source: "admin", action: "update-appointment-status", status: newStatus });
      await recordAuditLog({
        action: "appointment_status_updated",
        entityType: "appointment",
        entityId: appointmentId,
        entityLabel: appointment.clientName || appointment.client?.name || "Cliente",
        summary: `Status alterado para ${newStatus}.`,
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "update-appointment-status", status: newStatus });
      setAppointments(previousAppointments);
      notify("Erro ao atualizar status do agendamento. Tente novamente.");
      return false;
    }
  };
  const updateAppointment = async (appointmentId, updates) => {
    const previousAppointments = appointments;
    const currentAppointment = appointments.find((appointment) => appointment.id === appointmentId);
    if (!currentAppointment || !user) {
      notify("Agendamento nao encontrado.");
      return false;
    }

    if (isTerminalAppointment(currentAppointment)) {
      notify("Agendamentos concluidos ou cancelados nao podem ser editados.");
      return false;
    }

    const client = clients.find((clientItem) => String(clientItem.id) === String(updates.clientId));
    const service = services.find((serviceItem) => String(serviceItem.id) === String(updates.serviceId));
    const barber = barberOptions.find((barberItem) => String(barberItem.id) === String(updates.barberId));

    if (!client || !service || !barber || !updates.date || !updates.time) {
      notify("Preencha todos os dados do agendamento.");
      return false;
    }

    const duration = Number(service.duration) || 30;
    const startMinutes = timeToMinutes(updates.time);
    const endMinutes = startMinutes + duration;
    if (
        !isValidAppointmentTime({
          date: updates.date,
          time: updates.time,
          duration,
          businessHours: profile?.businessHours,
        })
    ) {
      notify("Escolha um horario dentro do funcionamento configurado e em uma data futura.");
      return false;
    }

    if (!isFutureAppointmentStart({ date: updates.date, time: updates.time })) {
      notify("Escolha um horario futuro para editar o agendamento.");
      return false;
    }

    if (!isDateWithinAppointmentWindow(updates.date, appointmentWindow)) {
      notify("Escolha uma data dentro da janela operacional da agenda.");
      return false;
    }

    const occupiedTimes = getOccupiedTimes({
      startMinutes,
      endMinutes,
      interval: getSlotInterval(profile),
    });
    const nextSlotIds = occupiedTimes.map((occupiedTime) =>
      createSlotId({
        userId: user.uid,
        barberId: barber.id,
        date: updates.date,
        time: occupiedTime,
      })
    );
    const previousSlotIds =
      currentAppointment.slotIds ||
      (currentAppointment.slotId ? [currentAppointment.slotId] : []);
    const previousSlotIdSet = new Set(previousSlotIds);
    const nextSlotRefs = nextSlotIds.map((slotId) => doc(db, "bookingSlots", slotId));
    const previousSlotRefs = previousSlotIds.map((slotId) => doc(db, "bookingSlots", slotId));

    const nextAppointment = {
      ...currentAppointment,
      client,
      clientId: client.id,
      clientName: client.name,
      clientPhone: client.phone,
      service,
      barberId: barber.id,
      barberName: barber.name,
      date: updates.date,
      time: updates.time,
      duration,
      startMinutes,
      endMinutes,
      slotId: nextSlotIds[0],
      slotIds: nextSlotIds,
      updatedAt: new Date(),
    };

    setAppointments((currentAppointments) =>
      currentAppointments.map((appointment) =>
        appointment.id === appointmentId ? nextAppointment : appointment
      )
    );

    try {
      await runTransaction(db, async (transaction) => {
        for (let index = 0; index < nextSlotRefs.length; index += 1) {
          const slotRef = nextSlotRefs[index];
          const slotId = nextSlotIds[index];
          if (previousSlotIdSet.has(slotId)) continue;

          const slotSnapshot = await transaction.get(slotRef);
          if (slotSnapshot.exists()) {
            throw new Error("slot-unavailable");
          }
        }

        previousSlotRefs.forEach((slotRef) => transaction.delete(slotRef));

        nextSlotRefs.forEach((slotRef, index) => {
          transaction.set(slotRef, {
            appointmentId,
            userId: user.uid,
            barberId: barber.id,
            barberName: barber.name,
            date: updates.date,
            time: occupiedTimes[index],
            rootTime: updates.time,
            duration,
            startMinutes,
            endMinutes,
            status: nextAppointment.status || APPOINTMENT_STATUS.pending,
            updatedAt: new Date(),
          });
        });

        const appointmentUpdate = { ...nextAppointment };
        delete appointmentUpdate.id;
        transaction.update(doc(db, "appointments", appointmentId), appointmentUpdate);
      });

      trackEvent("appointment_updated", { source: "admin", action: "update-appointment" });
      await recordAuditLog({
        action: "appointment_updated",
        entityType: "appointment",
        entityId: appointmentId,
        entityLabel: client.name,
        summary: `Agendamento remarcado para ${updates.date} as ${updates.time}.`,
      });
      return true;
    } catch (error) {
      reportError(error, { source: "admin", action: "update-appointment" });
      setAppointments(previousAppointments);
      notify(
        error.message === "slot-unavailable"
          ? "Este horario ja esta reservado. Escolha outro horario."
          : "Erro ao editar agendamento. Tente novamente."
      );
      return false;
    }
  };

  function sendWhatsApp(appointment) {
    const phone = normalizePhone(appointment.clientPhone || appointment.client?.phone);
    if (!phone) {
      notify("Este cliente nao tem telefone valido para WhatsApp.");
      return;
    }
    const clientName = appointment.clientName || appointment.client?.name || "cliente";
    const message = `Fala, ${clientName}! Passando para lembrar do seu horario dia ${appointment.date} as ${appointment.time}. Confirma para mim?`;

    const url = createWhatsAppUrl({ phone, message });
    window.open(url, "_blank", "noopener,noreferrer");
    trackEvent("whatsapp_reminder_opened", { source: "admin", action: "send-whatsapp" });
  }

  const totalRevenue = appointments
    .filter(isCompletedAppointment)
    .reduce((total, appointment) => {
      return total + (appointment?.service?.price ?? 0);
    }, 0);

  const barberOptions =
    barbers.length > 0
      ? barbers
      : user
      ? [
          {
            id: user.uid,
            name: profile?.barbershopName || profile?.displayName || "Equipe principal",
            ownerId: user.uid,
          },
        ]
      : [];

  const location = useLocation();
  
  // Detect if current route is a public booking page (/:slug)
  // Admin routes that should show sidebar
  const adminRoutes = ["/dashboard", "/clientes", "/servicos", "/barbeiros", "/financeiro", "/agenda", "/whatsapp", "/perfil", "/setup-profile"];
  const isAdminRoute = adminRoutes.some(route => location.pathname === route);
  const shouldShowSidebar = user && isAdminRoute;
  const routeAuth = { user, profile, authLoading, profileLoading };
  const dataWarningMessages = Object.values(dataWarnings);

  const renderRoute = () => {
    switch (location.pathname) {
      case "/login":
        return <LoginWrapper {...routeAuth} />;
      case "/register":
        return <RegisterWrapper {...routeAuth} />;
      case "/forgot-password":
        return <ForgotPassword />;
      case "/dashboard":
        return (
          <ProtectedRoute {...routeAuth}>
            <Dashboard
              totalRevenue={totalRevenue}
              appointments={appointments}
              clients={clients}
              services={services}
              barbers={barbers}
              profile={profile}
              appointmentWindow={appointmentWindow}
              auditLogs={auditLogs}
              auditLogsLoading={auditLogsLoading}
            />
          </ProtectedRoute>
        );
      case "/clientes":
        return (
          <ProtectedRoute {...routeAuth}>
            <Clients
              clients={clients}
              archivedClients={archivedClients}
              addClient={addClient}
              updateClient={updateClient}
              deleteClient={deleteClient}
              restoreClient={restoreClient}
              loading={clientsLoading}
            />
          </ProtectedRoute>
        );
      case "/servicos":
        return (
          <ProtectedRoute {...routeAuth}>
            <Services
              services={services}
              archivedServices={archivedServices}
              appointments={appointments}
              addService={addService}
              updateService={updateService}
              deleteService={deleteService}
              restoreService={restoreService}
              loading={servicesLoading}
              notify={notify}
            />
          </ProtectedRoute>
        );
      case "/financeiro":
        return (
          <ProtectedRoute {...routeAuth}>
            <Finance totalRevenue={totalRevenue} appointments={appointments} loading={appointmentsLoading} appointmentWindow={appointmentWindow} />
          </ProtectedRoute>
        );
      case "/barbeiros":
        return (
          <ProtectedRoute {...routeAuth}>
            <Barbers
              barbers={barbers}
              archivedBarbers={archivedBarbers}
              appointments={appointments}
              loading={barbersLoading}
              onBarbersChange={setBarbers}
              onArchivedBarbersChange={setArchivedBarbers}
              restoreBarber={restoreBarber}
              recordAuditLog={recordAuditLog}
              notify={notify}
            />
          </ProtectedRoute>
        );
      case "/agenda":
        return (
          <ProtectedRoute {...routeAuth}>
            <Schedule
              appointments={appointments}
              loading={appointmentsLoading || clientsLoading || servicesLoading || barbersLoading}
              clients={clients}
              services={services}
              barbers={barberOptions}
              businessHours={profile?.businessHours}
                appointmentWindow={appointmentWindow}
              selectedClient={selectedClient}
              setSelectedClient={setSelectedClient}
              selectedService={selectedService}
              setSelectedService={setSelectedService}
              selectedBarber={selectedBarber}
              setSelectedBarber={setSelectedBarber}
              appointmentDate={appointmentDate}
              setAppointmentDate={setAppointmentDate}
              appointmentTime={appointmentTime}
              setAppointmentTime={setAppointmentTime}
              addAppointment={addAppointment}
              sendWhatsApp={sendWhatsApp}
              updateAppointmentStatus={updateAppointmentStatus}
              updateAppointment={updateAppointment}
            />
          </ProtectedRoute>
        );
      case "/whatsapp":
        return (
          <ProtectedRoute {...routeAuth}>
            <WhatsApp />
          </ProtectedRoute>
        );
      case "/perfil":
        return (
          <ProtectedRoute {...routeAuth}>
            <ProfileSettings />
          </ProtectedRoute>
        );
      case "/setup-profile":
        return (
          <SetupRoute {...routeAuth}>
            <ProfileSetup />
          </SetupRoute>
        );
      default:
        return user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col lg:flex-row">
      {shouldShowSidebar && (
        <Sidebar
          clientsCount={clients.length}
          servicesCount={services.length}
          barbersCount={barbers.length}
          appointmentsCount={appointments.length}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {notification && (
          <div
            className={`fixed right-4 top-4 z-[60] max-w-sm rounded-2xl border px-4 py-3 text-sm shadow-2xl ${
              notification.type === "success"
                ? "border-emerald-500/60 bg-emerald-950 text-emerald-100"
                : "border-red-500/60 bg-red-950 text-red-100"
            }`}
            role="status"
          >
            {notification.message}
          </div>
        )}

        {shouldShowSidebar && dataError && (
          <div className="border-b border-yellow-800 bg-yellow-950/80 px-4 py-3 text-sm text-yellow-100 sm:px-6 lg:px-8">
            {dataError}
          </div>
        )}

        {shouldShowSidebar && !dataError && dataWarningMessages.length > 0 && (
          <div className="border-b border-yellow-800 bg-yellow-950/80 px-4 py-3 text-sm text-yellow-100 sm:px-6 lg:px-8">
            {dataWarningMessages[0]}
          </div>
        )}

        <Suspense fallback={<RouteLoading />}>
          {renderRoute()}
        </Suspense>
      </div>
    </div>
  );
}

