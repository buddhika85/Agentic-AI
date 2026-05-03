"use client";

import { KanbanBoard } from "@/components/KanbanBoard";
import { LoginForm } from "@/components/LoginForm";
import { AuthProvider, useAuth } from "@/lib/auth";
import { BoardProvider } from "@/lib/boardApi";

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();
  const token = typeof window !== "undefined" ? localStorage.getItem("authToken") : null;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  return isAuthenticated ? (
    <BoardProvider authToken={token} isAuthenticated={isAuthenticated}>
      <KanbanBoard />
    </BoardProvider>
  ) : (
    <LoginForm />
  );
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
