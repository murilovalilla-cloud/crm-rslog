import type { ReactNode } from "react";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { ApiError } from "@/lib/api";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";

/**
 * Garante que só renderizamos a aplicação quando o backend confirmou a
 * identidade do usuário (via Cloudflare Access em produção, ou o cabeçalho
 * de desenvolvimento local). Se a API recusar (401/403), mostramos uma
 * mensagem clara em vez de deixar o resto da tela tentar carregar dados sem
 * usuário autenticado.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { data, isLoading, error } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LoadingSpinner label="Verificando acesso..." />
      </div>
    );
  }

  if (error || !data) {
    const message =
      error instanceof ApiError
        ? error.message
        : "Não foi possível confirmar seu acesso ao CRM RS LOG.";
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md">
          <EmptyState tone="error" title="Acesso não autorizado" description={message} />
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
