import { ReactNode, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useScrollProgress, useScrollDirection } from "@/hooks/useScrollProgress";
import {
  Building2,
  Users,
  Home,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  User,
  Lock,
  TrendingUp,
  FileText,
  X,
  Moon,
  Sun
} from "lucide-react";
import { logout } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { EditProfileDialog } from "./EditProfileDialog";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { roleMenuPermissionService } from "@/services/roleMenuPermissionService";
import { ConnectionStatusToast } from "./ConnectionStatusToast";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user: authUser, refreshUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showProfileDialog, setShowProfileDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [mounted, setMounted] = useState(false);

  const scrollProgress = useScrollProgress();
  const scrollDirection = useScrollDirection();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Garantir que o tema seja aplicado após o mount
  useEffect(() => {
    setMounted(true);
    if (authUser?.theme) {
      setTheme(authUser.theme);
    }
  }, [authUser?.theme]);

  useEffect(() => {
    loadPermissions();
  }, [authUser]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [mobileMenuOpen]);

  const loadPermissions = async () => {
    try {
      const perms = await roleMenuPermissionService.getAll();
      setPermissions(perms);
    } catch (error) {
      console.error("Error loading permissions:", error);
    }
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleToggleTheme = async () => {
    if (!authUser?.id) return;
    
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    
    try {
      // Atualizar tema no banco de dados
      const { error } = await supabase
        .from('system_users')
        .update({ theme: newTheme })
        .eq('id', authUser.id);

      if (error) throw error;

      // Aplicar tema imediatamente
      setTheme(newTheme);

      // Atualizar sessão local
      const sessionStr = localStorage.getItem("auth_session");
      if (sessionStr) {
        const session = JSON.parse(sessionStr);
        session.user.theme = newTheme;
        localStorage.setItem("auth_session", JSON.stringify(session));
        localStorage.setItem("auth_user", JSON.stringify(session.user));
      }

      // Atualizar contexto
      refreshUser();

      toast({
        title: "Tema alterado",
        description: `Tema ${newTheme === 'dark' ? 'escuro' : 'claro'} aplicado com sucesso.`,
      });
    } catch (error) {
      console.error("Error updating theme:", error);
      toast({
        title: "Erro",
        description: "Não foi possível alterar o tema.",
        variant: "destructive",
      });
    }
  };

  const handleChangePassword = () => {
    if (!authUser) return;

    if (newPassword !== confirmPassword) {
      toast({
        title: "Erro!",
        description: "As senhas não coincidem!",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Erro!",
        description: "A nova senha deve ter no mínimo 8 caracteres!",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Senha alterada com sucesso!",
      description: "Sua senha foi atualizada com sucesso.",
      variant: "default",
    });

    setShowPasswordDialog(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  const isActive = (path: string) => router.pathname === path;

  const roleDisplayName = (role?: string) => {
    const roleMap: Record<string, string> = {
      admin: "Administrador",
      broker: "Corretor",
      financial: "Financeiro",
      user: "Usuário",
    };
    return roleMap[role || "user"] || "Usuário";
  };

  const shouldShowMenu = (menuPath: string) => {
    if (!authUser?.role) return false;
    if (authUser.role === "admin") return true;

    const menuItemMap: Record<string, string> = {
      "/dashboard": "dashboard",
      "/properties": "properties",
      "/tenants": "tenants",
      "/rentals": "rentals",
      "/payments": "payments",
      "/financial": "financial",
      "/settings": "settings",
    };

    const menuItem = menuItemMap[menuPath];
    if (!menuItem) return false;

    if (menuPath === "/financial" && authUser.role === "broker") return true;

    const permission = permissions.find(
      (p) => p.role === authUser.role && p.menu_id === menuItem
    );

    return permission ? true : false;
  };

  const menuItems = [
    { 
      name: "Painel", 
      path: "/dashboard", 
      icon: Home,
      permission: "canViewDashboard" 
    },
    { 
      name: "Imóveis", 
      path: "/properties", 
      icon: Building2,
      permission: "canViewProperties" 
    },
    { 
      name: "Inquilinos", 
      path: "/tenants", 
      icon: Users,
      permission: "canViewTenants" 
    },
    { 
      name: "Locações", 
      path: "/rentals", 
      icon: FileText,
      permission: "canViewRentals" 
    },
    { 
      name: "Recebimentos", 
      path: "/payments", 
      icon: DollarSign,
      permission: "canViewPayments" 
    },
    { 
      name: "Financeiro", 
      path: "/financial", 
      icon: TrendingUp,
      permission: "canViewFinancial" 
    },
    { 
      name: "Configurações", 
      path: "/settings", 
      icon: Settings,
      permission: "canViewSettings" 
    },
  ];

  const navigationItems = menuItems.filter(item => shouldShowMenu(item.path));

  // Não renderizar até montar (evita flash de tema errado)
  if (!mounted) {
    return null;
  }

  const currentTheme = theme || 'light';
  const oppositeTheme = currentTheme === 'dark' ? 'Light' : 'Dark';
  const ThemeIcon = currentTheme === 'dark' ? Sun : Moon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 overflow-x-hidden">
      {/* Scroll Progress Bar */}
      <motion.div
        className="fixed top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 to-blue-600 origin-left z-50"
        style={{ scaleX: scrollProgress / 100 }}
        initial={{ scaleX: 0 }}
        transition={{ duration: 0.1 }}
      />

      {/* Navbar */}
      <motion.nav
        className="fixed top-0 left-0 right-0 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 shadow-sm z-40"
        initial={{ y: 0 }}
        animate={{
          y: scrollDirection === "down" && scrollProgress > 5 ? -100 : 0,
        }}
        transition={{ duration: 0.3 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-14 sm:h-16 flex items-center justify-between gap-2 sm:gap-4">
            {/* Mobile Menu Button & Logo */}
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0 min-w-0">
              <Button
                id="layout-mobile-menu-button"
                variant="ghost"
                size="icon"
                className="md:hidden h-10 w-10 flex-shrink-0"
                onClick={() => setMobileMenuOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </Button>

              <Link href="/" className="flex items-center gap-2 min-w-0">
                <Building2 className="h-7 w-7 sm:h-8 sm:w-8 text-blue-600 flex-shrink-0" />
                <span className="font-bold text-slate-900 dark:text-slate-100 text-xs sm:text-sm whitespace-nowrap truncate">
                  D&apos;Uvo Enterprise
                </span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center gap-1 flex-1 justify-center px-4">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);
                
                return (
                  <Link
                    id={`layout-nav-${item.path.slice(1)}`}
                    key={item.name}
                    href={item.path}
                    className={cn(
                      "group flex items-center gap-x-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all whitespace-nowrap",
                      active
                        ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400"
                        : "text-slate-700 hover:bg-slate-50 hover:text-blue-600 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-blue-400"
                    )}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>

            {/* Desktop User Menu */}
            <div className="hidden md:flex items-center gap-3 flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button 
                    id="layout-user-menu-trigger" 
                    variant="ghost" 
                    className="relative h-10 w-10 rounded-full p-0 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Avatar className="h-10 w-10 border-2 border-blue-600/20 cursor-pointer hover:border-blue-600/40 transition-colors">
                      <AvatarImage src={authUser?.photo} alt={authUser?.name} className="object-cover" />
                      <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium text-sm">
                        {authUser?.name?.substring(0, 2).toUpperCase() || "US"}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium leading-none">{authUser?.name}</p>
                    <p className="text-xs text-muted-foreground mt-1">{roleDisplayName(authUser?.role)}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem id="layout-menu-edit-profile" onClick={() => setShowProfileDialog(true)} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Editar Perfil
                  </DropdownMenuItem>
                  <DropdownMenuItem id="layout-menu-change-password" onClick={() => setShowPasswordDialog(true)} className="cursor-pointer">
                    <Lock className="mr-2 h-4 w-4" />
                    Trocar Senha
                  </DropdownMenuItem>
                  <DropdownMenuItem id="layout-menu-toggle-theme" onClick={handleToggleTheme} className="cursor-pointer">
                    <ThemeIcon className="mr-2 h-4 w-4" />
                    Trocar Tema ({oppositeTheme})
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem id="layout-menu-logout" onClick={handleLogout} className="text-red-600 dark:text-red-400 cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Mobile User Avatar */}
            <div className="md:hidden flex-shrink-0">
              <Avatar className="h-9 w-9 border-2 border-blue-600/20">
                <AvatarImage src={authUser?.photo} alt={authUser?.name} className="object-cover" />
                <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium text-xs">
                  {authUser?.name?.substring(0, 2).toUpperCase() || "US"}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 md:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
            />
            <motion.div
              className="fixed inset-y-0 left-0 w-[280px] bg-white dark:bg-slate-900 shadow-xl z-50 md:hidden overflow-y-auto"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
            >
              <div className="p-4 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">D&apos;Uvo</span>
                  </div>
                  <Button
                    id="layout-mobile-menu-close"
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>

                {/* User Info */}
                <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Avatar className="h-12 w-12 border-2 border-blue-600/20">
                    <AvatarImage src={authUser?.photo} alt={authUser?.name} className="object-cover" />
                    <AvatarFallback className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300 font-medium">
                      {authUser?.name?.substring(0, 2).toUpperCase() || "US"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{authUser?.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{roleDisplayName(authUser?.role)}</p>
                  </div>
                </div>

                <Separator />

                {/* Navigation */}
                <nav className="space-y-1">
                  {navigationItems.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.path);
                    return (
                      <Link
                        id={`layout-mobile-nav-${item.path.slice(1)}`}
                        key={item.name}
                        href={item.path}
                        onClick={() => setMobileMenuOpen(false)}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors touch-target",
                          active 
                            ? "bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400" 
                            : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
                        )}
                      >
                        <Icon className="h-5 w-5 flex-shrink-0" />
                        {item.name}
                      </Link>
                    );
                  })}
                </nav>

                <Separator />

                {/* Actions */}
                <div className="space-y-2">
                  <Button
                    id="layout-mobile-edit-profile"
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 text-sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowProfileDialog(true);
                    }}
                  >
                    <User className="h-4 w-4" />
                    Editar Perfil
                  </Button>
                  <Button
                    id="layout-mobile-change-password"
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 text-sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setShowPasswordDialog(true);
                    }}
                  >
                    <Lock className="h-4 w-4" />
                    Trocar Senha
                  </Button>
                  <Button
                    id="layout-mobile-toggle-theme"
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 text-sm"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleToggleTheme();
                    }}
                  >
                    <ThemeIcon className="h-4 w-4" />
                    Trocar Tema ({oppositeTheme})
                  </Button>
                  <Button
                    id="layout-mobile-logout"
                    variant="outline"
                    className="w-full justify-start gap-3 h-11 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      handleLogout();
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </Button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <motion.main
        className="pt-16 sm:pt-20 pb-6 sm:pb-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full overflow-x-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        {children}
      </motion.main>

      {/* Edit Profile Dialog */}
      {authUser?.id && (
        <EditProfileDialog
          user={authUser as unknown as import("@/types").SystemUser}
          open={showProfileDialog}
          onOpenChange={setShowProfileDialog}
          onSuccess={() => {
            refreshUser();
          }}
        />
      )}

      {/* Change Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent id="layout-password-dialog" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Trocar Senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="current-password">Senha Atual</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Nova Senha</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
              <Button 
                id="layout-password-cancel"
                variant="outline" 
                onClick={() => {
                  setShowPasswordDialog(false);
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                }} 
                className="flex-1 h-11"
              >
                Cancelar
              </Button>
              <Button id="layout-password-submit" onClick={handleChangePassword} className="flex-1 h-11">
                Alterar Senha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Connection Status Monitor */}
      <ConnectionStatusToast />
    </div>
  );
}