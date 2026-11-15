import React from "react";
import {
  Home,
  MessageSquare,
  KeyRound,
  Settings,
  UserCheck,
  Smartphone,
  LogIn,
  LogOut,
  Sun,
  Moon,
  X,
} from "lucide-react";
import { PageRoute, UserProfile } from "../types/mkai";

interface SidebarProps {
  activePage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  user: UserProfile | null;
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onNavigate,
  user,
  theme,
  onToggleTheme,
  onLogout,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{ id: PageRoute; label: string; icon: React.ReactNode }> = [
    { id: "home", label: "Home", icon: <Home className="w-4 h-4 shrink-0" /> },
    { id: "chat", label: "AI Chat", icon: <MessageSquare className="w-4 h-4 shrink-0" /> },
    { id: "dashboard", label: "API Dashboard", icon: <KeyRound className="w-4 h-4 shrink-0" /> },
    { id: "download", label: "Android APK", icon: <Smartphone className="w-4 h-4 shrink-0" /> },
    { id: "settings", label: "Settings", icon: <Settings className="w-4 h-4 shrink-0" /> },
    { id: "about", label: "About Developer", icon: <UserCheck className="w-4 h-4 shrink-0" /> },
  ];

  const handleSelect = (page: PageRoute) => {
    onNavigate(page);
    onCloseMobile();
  };

  const sidebarBody = (
    <div className="flex flex-col h-full bg-white dark:bg-[#0B0714] border-r border-slate-200 dark:border-violet-500/20 text-slate-900 dark:text-slate-100">
      {/* Brand Header */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-slate-200 dark:border-violet-500/15">
        <button
          type="button"
          onClick={() => handleSelect("home")}
          className="flex items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 rounded-lg"
        >
          <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-sky-500 flex items-center justify-center text-white font-display font-bold text-sm shrink-0">
            MK
          </span>
          <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap">
            M.K AI
          </span>
        </button>

        <button
          type="button"
          onClick={onCloseMobile}
          className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          aria-label="Close navigation menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Primary Navigation">
        {navItems.map((item) => {
          const isActive = activePage === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? "bg-violet-600/12 text-violet-700 dark:bg-violet-500/20 dark:text-sky-300"
                  : "text-slate-600 hover:text-slate-950 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-100 dark:hover:bg-white/5"
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Theme & Account Footer */}
      <div className="p-4 border-t border-slate-200 dark:border-violet-500/15 space-y-3">
        <button
          type="button"
          onClick={onToggleTheme}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-lg text-sm font-medium bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 transition-colors"
        >
          <span>{theme === "dark" ? "Dark Theme" : "Light Theme"}</span>
          {theme === "dark" ? (
            <Moon className="w-4 h-4 text-sky-400" />
          ) : (
            <Sun className="w-4 h-4 text-amber-500" />
          )}
        </button>

        {user ? (
          <div className="space-y-2 pt-1">
            <div className="px-1">
              <p className="text-sm font-semibold truncate">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email} · {user.role === "admin" ? "Developer Admin" : "Member"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onLogout();
                onCloseMobile();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 rounded-lg text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleSelect("login")}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-violet-600 text-white hover:bg-violet-500 transition-colors whitespace-nowrap"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Login</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelect("register")}
              className="flex items-center justify-center px-3 py-2 rounded-lg text-xs font-semibold border border-slate-300 dark:border-violet-500/30 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors whitespace-nowrap"
            >
              <span>Register</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 h-screen sticky top-0">
        {sidebarBody}
      </aside>

      {/* Mobile slide-over drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative w-[272px] max-w-[85vw] h-full z-10">
            {sidebarBody}
          </aside>
        </div>
      )}
    </>
  );
};
