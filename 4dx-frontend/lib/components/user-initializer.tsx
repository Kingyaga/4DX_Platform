"use client";

import { useEffect } from "react";
import { useCurrentUser } from "@/lib/hooks";
import { useTimedMessage } from "@/lib/useTimedMessage";

/**
 * Initialize user store from NextAuth session and fetch profile from backend
 */
export function UserInitializer({ children }: { children: React.ReactNode }) {
  const [welcomeMessage, setWelcomeMessage] = useTimedMessage<string | null>(null, 3000);

  // This hook fetches the current user's profile with role from the backend
  const { data: me, isLoading } = useCurrentUser();

  // Show welcome message when user data is first loaded
  useEffect(() => {
    if (me && me.name && !isLoading) {
      const hasSeenWelcome = sessionStorage.getItem('hasSeenWelcome');
      if (!hasSeenWelcome) {
        setWelcomeMessage(`Welcome back, ${me.name}!`);
        sessionStorage.setItem('hasSeenWelcome', 'true');
      }
    }
  }, [me, isLoading, setWelcomeMessage]);

  return (
    <>
      {children}
      {welcomeMessage && (
        <div
          style={{
            position: "fixed",
            top: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#18181b",
            color: "#ffffff",
            padding: "12px 24px",
            borderRadius: "8px",
            fontSize: "16px",
            fontWeight: 600,
            zIndex: 1000,
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            animation: "fadeInOut 3s ease-in-out",
          }}
        >
          {welcomeMessage}
        </div>
      )}
      <style jsx>{`
        @keyframes fadeInOut {
          0% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
          10% { opacity: 1; transform: translateX(-50%) translateY(0); }
          90% { opacity: 1; transform: translateX(-50%) translateY(0); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
        }
      `}</style>
    </>
  );
}
