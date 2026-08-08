import { useEffect, useState } from "react";

const getOnlineStatus = () => (typeof navigator === "undefined" ? true : navigator.onLine);

export default function NetworkStatusBanner() {
  const [isOnline, setIsOnline] = useState(getOnlineStatus);

  useEffect(() => {
    const updateStatus = () => setIsOnline(getOnlineStatus());

    window.addEventListener("online", updateStatus);
    window.addEventListener("offline", updateStatus);

    return () => {
      window.removeEventListener("online", updateStatus);
      window.removeEventListener("offline", updateStatus);
    };
  }, []);

  if (isOnline) return null;

  return (
    <div
      className="fixed inset-x-0 top-0 z-[80] border-b border-yellow-600 bg-yellow-950 px-4 py-3 text-center text-sm font-medium text-yellow-100 shadow-lg"
      role="status"
      aria-live="polite"
    >
      Sem conexao com a internet. Algumas informacoes podem nao sincronizar ate a conexao voltar.
    </div>
  );
}
