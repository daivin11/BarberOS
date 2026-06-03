import { useState, useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Navigate } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Dashboard from "./pages/Dashboard";
import Clients from "./pages/Clients";
import Services from "./pages/Services";
import Finance from "./pages/Finance";
import Barbers from "./pages/Barbers";
import Schedule from "./pages/Schedule";
import WhatsApp from "./pages/WhatsApp";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ProfileSetup from "./pages/ProfileSetup";
import ProfileSettings from "./pages/ProfileSettings";
import TrialExpired from "./pages/TrialExpired";
import PublicBooking from "./pages/PublicBooking";
import { collection, getDocs, addDoc, query, where, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "./services/firebase";
import { useAuth } from "./contexts/AuthContext";
import { isTrialActive } from "./utils/trial";

export default function App() {
  const { user, profile, loading: authLoading, profileLoading } = useAuth();
  const [clients, setClients] = useState([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [services, setServices] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [appointments, setAppointments] = useState([]);

  

  const [selectedClient, setSelectedClient] = useState("");
  const [selectedService, setSelectedService] = useState("");
  const [selectedBarber, setSelectedBarber] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [appointmentTime, setAppointmentTime] = useState("");


  // Load clients, services, and appointments from Firestore when user is available
  useEffect(() => {
    if (!user) {
      setClients([]);
      setClientsLoading(false);
      setServices([]);
      setBarbers([]);
      setAppointments([]);
      return;
    }

    const fetchClients = async () => {
      try {
        const clientsQuery = query(collection(db, "clients"), where("userId", "==", user.uid));
        const clientsSnapshot = await getDocs(clientsQuery);
        const clientsList = clientsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setClients(clientsList);
      } catch (error) {
        console.error("Error fetching clients:", error);
      } finally {
        setClientsLoading(false);
      }
    };

    const fetchServices = async () => {
      try {
        const servicesQuery = query(collection(db, "services"), where("userId", "==", user.uid));
        const servicesSnapshot = await getDocs(servicesQuery);
        const servicesList = servicesSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setServices(servicesList);
      } catch (error) {
        console.error("Error fetching services:", error);
      }
    };

    const fetchBarbers = async () => {
      try {
        const barbersQuery = query(collection(db, "barbers"), where("ownerId", "==", user.uid));
        const barbersSnapshot = await getDocs(barbersQuery);
        const barbersList = barbersSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setBarbers(barbersList);
      } catch (error) {
        console.error("Error fetching barbers:", error);
      }
    };

    const fetchAppointments = async () => {
      try {
        const appointmentsQuery = query(collection(db, "appointments"), where("userId", "==", user.uid));
        const appointmentsSnapshot = await getDocs(appointmentsQuery);
        const appointmentsList = appointmentsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setAppointments(appointmentsList);
      } catch (error) {
        console.error("Error fetching appointments:", error);
      }
    };

    fetchClients();
    fetchServices();
    fetchBarbers();
    fetchAppointments();
  }, [user]);

  const addClient = async (name, phone) => {
    if (!name || !phone) {
      alert("Preencha nome e telefone do cliente");
      return;
    }

    try {
      const newClient = {
        name,
        phone,
        createdAt: new Date(),
        userId: user ? user.uid : undefined,
      };

      const docRef = await addDoc(collection(db, "clients"), newClient);
      const clientWithId = { id: docRef.id, ...newClient };
      setClients((prevClients) => [...prevClients, clientWithId]);
      return true;
    } catch (error) {
      console.error("Error adding client:", error);
      alert("Erro ao adicionar cliente. Tente novamente.");
      return false;
    }
  };

  const addService = async (name, price) => {
    if (!name || !price) {
      alert("Preencha nome e preço do serviço");
      return;
    }

    try {
      const newService = {
        name,
        price: Number(price),
        createdAt: new Date(),
        userId: user ? user.uid : undefined,
      };

      const docRef = await addDoc(collection(db, "services"), newService);
      const serviceWithId = { id: docRef.id, ...newService };
      setServices((prev) => [...prev, serviceWithId]);
    } catch (error) {
      console.error("Error adding service:", error);
      alert("Erro ao adicionar serviço. Tente novamente.");
    }
  };

  const updateService = async (serviceId, updates) => {
    try {
      const serviceRef = doc(db, "services", serviceId);
      await updateDoc(serviceRef, updates);
      setServices((prev) => prev.map((service) => (service.id === serviceId ? { ...service, ...updates } : service)));
    } catch (error) {
      console.error("Error updating service:", error);
      alert("Erro ao atualizar serviço. Tente novamente.");
    }
  };

  const deleteService = async (serviceId) => {
    try {
      const serviceRef = doc(db, "services", serviceId);
      await deleteDoc(serviceRef);
      setServices((prev) => prev.filter((service) => service.id !== serviceId));
    } catch (error) {
      console.error("Error deleting service:", error);
      alert("Erro ao excluir serviço. Tente novamente.");
    }
  };

  const addAppointment = async () => {
    if (!selectedClient || !selectedService || !selectedBarber || !appointmentDate || !appointmentTime) {
      alert("Preencha todos os dados do agendamento");
      return;
    }

    try {
      const client = clients.find((client) => String(client.id) === String(selectedClient));
      const service = services.find((service) => String(service.id) === String(selectedService));
      const barber = barberOptions.find((barberItem) => String(barberItem.id) === String(selectedBarber));

      const newAppointment = {
        client,
        service,
        barberId: barber?.id,
        barberName: barber?.name,
        date: appointmentDate,
        time: appointmentTime,
        status: "pending",
        createdAt: new Date(),
        userId: user ? user.uid : undefined,
      };

      const docRef = await addDoc(collection(db, "appointments"), newAppointment);
      const appointmentWithId = { id: docRef.id, ...newAppointment };

      setAppointments([...appointments, appointmentWithId]);
      setSelectedClient("");
      setSelectedService("");
      setSelectedBarber("");
      setAppointmentDate("");
      setAppointmentTime("");
    } catch (error) {
      console.error("Error adding appointment:", error);
      alert("Erro ao adicionar agendamento. Tente novamente.");
    }
  };

  const updateAppointmentStatus = async (appointmentId, newStatus) => {
    try {
      const appointmentRef = doc(db, "appointments", appointmentId);
      await updateDoc(appointmentRef, { status: newStatus });

      // Update local state
      setAppointments(
        appointments.map((apt) =>
          apt.id === appointmentId ? { ...apt, status: newStatus } : apt
        )
      );
    } catch (error) {
      console.error("Error updating appointment status:", error);
      alert("Erro ao atualizar status do agendamento. Tente novamente.");
    }
  };

  function ProtectedRoute({ children }) {
    if (authLoading || profileLoading) return <div className="flex-1 p-6">Carregando...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (user && profile && !profile.profileComplete) return <Navigate to="/setup-profile" replace />;
    if (user && profile && !isTrialActive(profile)) return <TrialExpired />;
    return children;
  }

  function SetupRoute({ children }) {
    if (authLoading || profileLoading) return <div className="flex-1 p-6">Carregando...</div>;
    if (!user) return <Navigate to="/login" replace />;
    if (user && profile && profile.profileComplete) return <Navigate to="/" replace />;
    return children;
  }

  function LoginWrapper() {
    if (authLoading || profileLoading) return <div className="flex-1 p-6">Carregando...</div>;
    if (user) return <Navigate to={profile?.profileComplete ? "/" : "/setup-profile"} replace />;
    return <Login />;
  }

  function RegisterWrapper() {
    if (authLoading || profileLoading) return <div className="flex-1 p-6">Carregando...</div>;
    if (user) return <Navigate to={profile?.profileComplete ? "/" : "/setup-profile"} replace />;
    return <Register />;
  }

  function sendWhatsApp(appointment) {
    const phone = appointment.client.phone;
    const message = `Fala, ${appointment.client.name}! 💈 Passando pra lembrar do seu horário dia ${appointment.date} às ${appointment.time}. Confirma pra mim?`;

    const url = `https://wa.me/55${phone}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank");
  }

  const totalRevenue = appointments.reduce((total, appointment) => {
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
  const adminRoutes = ["/", "/clientes", "/servicos", "/barbeiros", "/financeiro", "/agenda", "/whatsapp", "/perfil", "/setup-profile"];
  const isAdminRoute = adminRoutes.some(route => location.pathname === route);
  const isPublicBookingPage = user && !isAdminRoute && location.pathname !== "/login" && location.pathname !== "/register";
  const shouldShowSidebar = user && !isPublicBookingPage;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col md:flex-row">
      {shouldShowSidebar && <Sidebar />}

      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginWrapper />} />
        <Route path="/register" element={<RegisterWrapper />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard
                totalRevenue={totalRevenue}
                appointments={appointments}
                clients={clients}
                services={services}
                profile={profile}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/clientes"
          element={
            <ProtectedRoute>
              <Clients
                clients={clients}
                addClient={addClient}
                loading={clientsLoading}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/servicos"
          element={
            <ProtectedRoute>
              <Services
                services={services}
                appointments={appointments}
                addService={addService}
                updateService={updateService}
                deleteService={deleteService}
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/financeiro"
          element={
            <ProtectedRoute>
              <Finance totalRevenue={totalRevenue} appointments={appointments} />
            </ProtectedRoute>
          }
        />

        <Route
          path="/barbeiros"
          element={
            <ProtectedRoute>
              <Barbers />
            </ProtectedRoute>
          }
        />

        <Route
          path="/agenda"
          element={
            <ProtectedRoute>
              <Schedule
                appointments={appointments}
                clients={clients}
                services={services}
                barbers={barberOptions}
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
              />
            </ProtectedRoute>
          }
        />

        <Route
          path="/whatsapp"
          element={
            <ProtectedRoute>
              <WhatsApp />
            </ProtectedRoute>
          }
        />

        <Route
          path="/perfil"
          element={
            <ProtectedRoute>
              <ProfileSettings />
            </ProtectedRoute>
          }
        />

        <Route
          path="/setup-profile"
          element={
            <SetupRoute>
              <ProfileSetup />
            </SetupRoute>
          }
        />

        <Route path="/:slug" element={<PublicBooking />} />

        {/* Fallback: redirect to login if not authenticated */}
        <Route path="*" element={user ? <Navigate to="/" /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}
