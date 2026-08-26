import { Menu, LogOut } from "lucide-react";
import { initials } from "@/lib/utils";
import { useCurrentUser } from "@/hooks/useCurrentUser";

export function Topbar({ onOpenMobileMenu, title }: { onOpenMobileMenu: () => void; title: string }) {
  const { data: user } = useCurrentUser();

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200 bg-white px-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
          aria-label="Abrir menu"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <h1 className="text-base font-semibold text-slate-800">{title}</h1>
      </div>

      {user && (
        <div className="flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium text-slate-700">{user.name}</p>
            <p className="text-xs text-slate-400">{user.role === "admin" ? "Administrador" : "Vendedor"}</p>
          </div>
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-navy-600 text-xs font-semibold text-white">
            {initials(user.name)}
          </div>
          {/* O login é feito pelo Cloudflare Access; este link aciona o
              endpoint de logout dele (/cdn-cgi/access/logout), que encerra a
              sessão do Access e pede autenticação novamente. Em ambientes
              sem o Access configurado na frente (dev local), o link fica
              inofensivo. */}
          <a
            href="/cdn-cgi/access/logout"
            className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 hover:underline"
            title="Encerrar sessão do Cloudflare Access"
          >
            <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden="true" />
            Sair
          </a>
        </div>
      )}
    </header>
  );
}
