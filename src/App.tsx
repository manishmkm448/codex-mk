import { useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { Sidebar } from "./components/Sidebar";
import { apiRequest, getStoredToken, setStoredToken } from "./lib/api";
import { AboutPage } from "./pages/AboutPage";
import { AuthPage } from "./pages/AuthPage";
import { ChatPage } from "./pages/ChatPage";
import { DashboardPage } from "./pages/DashboardPage";
import { DownloadApkPage } from "./pages/DownloadApkPage";
import { HomePage } from "./pages/HomePage";
import { SettingsPage } from "./pages/SettingsPage";
import { PageRoute, UserProfile } from "./types/mkai";

export default function App() {
  const [activePage, setActivePage] = useState<PageRoute>("home");
  const [user, setUser] = useState<UserProfile | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("mkai_theme");
    return saved === "light" ? "light" : "dark";
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    localStorage.setItem("mkai_theme", theme);
  }, [theme]);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) return;
    apiRequest<{ user: UserProfile }>("/api/auth/me")
      .then((res) => {
        setUser(res.user);
        if (res.user.theme === "light" || res.user.theme === "dark") {
          setTheme(res.user.theme);
        }
      })
      .catch(() => {
        setStoredToken(null);
      });
  }, []);

  const handleToggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    if (user) {
      void apiRequest("/api/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({ theme: next }),
      }).catch(() => {});
    }
  };

  const handleLogout = () => {
    setStoredToken(null);
    setUser(null);
    setActivePage("home");
  };

  const handleLaunchWithCommand = (command: string) => {
    setQueuedPrompt(command);
    setActivePage("chat");
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-[#06040C] text-slate-900 dark:text-slate-100">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        user={user}
        theme={theme}
        onToggleTheme={handleToggleTheme}
        onLogout={handleLogout}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Three-Line Hamburger Header */}
        <header className="lg:hidden h-16 px-4 border-b border-slate-200 dark:border-violet-500/15 bg-white/90 dark:bg-[#0B0714]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="p-2 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
            aria-label="Open navigation menu"
          >
            <Menu className="w-6 h-6" />
          </button>

          <button
            type="button"
            onClick={() => setActivePage("home")}
            className="font-display font-bold text-lg tracking-tight"
          >
            M.K AI
          </button>

          <button
            type="button"
            onClick={() => setActivePage(user ? "chat" : "login")}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-violet-600 text-white whitespace-nowrap shrink-0"
          >
            {user ? "AI Chat" : "Login"}
          </button>
        </header>

        <main className="flex-1 min-w-0">
          {activePage === "home" && (
            <HomePage
              user={user}
              onNavigate={setActivePage}
              onLaunchWithCommand={handleLaunchWithCommand}
            />
          )}
          {activePage === "chat" && (
            <ChatPage
              user={user}
              initialPrompt={queuedPrompt}
              onConsumeInitialPrompt={() => setQueuedPrompt(null)}
              onNavigate={setActivePage}
            />
          )}
          {activePage === "dashboard" && (
            <DashboardPage user={user} onNavigate={setActivePage} />
          )}
          {activePage === "settings" && (
            <SettingsPage
              user={user}
              theme={theme}
              onToggleTheme={handleToggleTheme}
              onProfileUpdated={setUser}
              onNavigate={setActivePage}
            />
          )}
          {activePage === "about" && <AboutPage onNavigate={setActivePage} />}
          {activePage === "download" && <DownloadApkPage />}
          {(activePage === "login" || activePage === "register") && (
            <AuthPage
              mode={activePage}
              onSuccess={setUser}
              onNavigate={setActivePage}
            />
          )}
        </main>
      </div>
    </div>
  );
}
