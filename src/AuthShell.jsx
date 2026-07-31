import { AuthProvider } from "./contexts/AuthContext";
import AdminApp from "./AdminApp";

export default function AuthShell() {
  return (
    <AuthProvider>
      <AdminApp />
    </AuthProvider>
  );
}
