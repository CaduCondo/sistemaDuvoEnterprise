import { useState, useEffect, useCallback } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { 
  Save, 
  MapPin, 
  Building2,
  Percent,
  AlertCircle,
  Coins,
  Plus,
  Pencil,
  Trash2,
  Users,
  Shield,
  Wallet,
  HelpCircle,
  FileText,
  Calculator,
  CreditCard,
} from "lucide-react";

// Services
import { 
  getConfig, 
  updateConfig 
} from "@/services/configService";
import * as locationService from "@/services/locationService";
import { getAllPaymentMethods, createPaymentMethod, updatePaymentMethod, deletePaymentMethod, type PaymentMethod } from "@/services/paymentMethodService";

// Helpers
import {
  applyCnpjMask,
  applyPhoneMask,
  applyCepMask,
  parsePercentageToFloat,
  formatPercentage,
  applyPercentageMask
} from "@/lib/masks";

// Types
import { Location, CompanyConfig } from "@/types";

// New modular components
import { UsersTab } from "@/components/settings/UsersTab";
import { PermissionsTab } from "@/components/settings/PermissionsTab";
import { FeeExemptionDialog } from "@/components/settings/FeeExemptionDialog";
import { UserDialog } from "@/components/settings/UserDialog";

// Custom hooks
import { useUsers } from "@/hooks/useUsers";
import { usePermissions } from "@/hooks/usePermissions";
import { LocationExpensesDialog } from "@/components/settings/LocationExpensesDialog";
import { HelpDialog } from "@/components/HelpDialog";

export default function Settings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("company");
  const [helpOpen, setHelpOpen] = useState(false);

  // Config State
  const [config, setConfig] = useState<CompanyConfig>({
    id: "",
    company_name: "",
    cnpj: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    state: "",
    zip_code: "",
    admin_fee_percentage: 0,
    management_fee_percentage: 0,
    late_fee_percentage: 0,
    interest_rate_percentage: 0,
    logo_url: null,
    primary_color: null,
    secondary_color: null,
    created_at: "",
    updated_at: "",
  });

  // State for form inputs (strings to handle formatting)
  const [adminFee, setAdminFee] = useState("0,000");
  const [managementFee, setManagementFee] = useState("0,000");
  const [lateFee, setLateFee] = useState("0,000");
  const [interestRate, setInterestRate] = useState("0,000");

  // Locations State
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoadingLocations, setIsLoadingLocations] = useState(false);
  const [searchLocation, setSearchLocation] = useState("");
  const [isLocationDialogOpen, setIsLocationDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [locationForm, setLocationForm] = useState({
    name: "",
    street: "",
    number: "",
    complement: "",
    neighborhood: "",
    city: "",
    state: "",
    zip_code: "",
    is_active: true,
  });
  const [locationToDelete, setLocationToDelete] = useState<Location | null>(null);
  
  // Estados para LocationExpensesDialog
  const [isExpensesDialogOpen, setIsExpensesDialogOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  
  // Estados para Formas de Pagamento
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isPaymentMethodDialogOpen, setIsPaymentMethodDialogOpen] = useState(false);
  const [editingPaymentMethod, setEditingPaymentMethod] = useState<PaymentMethod | null>(null);
  const [paymentMethodForm, setPaymentMethodForm] = useState({
    name: "",
    code: "",
    active: true,
    display_order: 0,
  });

  // Use custom hooks for users and permissions
  const { 
    permissions, 
    loading: permissionsLoading, 
    updateRoleMenuPermission, 
    saveLocationPermissions, 
    saveAdminFeeExemptions,
    getAdminFeeExemptions,
    saveManagementFeeExemptions,
    getManagementFeeExemptions,
    getUserLocationPermissions,
  } = usePermissions();

  const { 
    users, 
    isLoading: usersLoading,
    error: usersError, 
    refresh: refreshUsers,
    handleCreateUser,
    handleUpdateUser,
    handleDeleteUser,
    handleToggleUserStatus,
    handleUnblockUser
  } = useUsers();

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        await Promise.all([
          loadConfig(),
          fetchLocations(),
          fetchPaymentMethods()
        ]);
      } catch (err) {
        console.error("Error loading settings data:", err);
      }
    };

    loadData();
  }, [user?.id]);
  
  const fetchPaymentMethods = async () => {
    try {
      const data = await getAllPaymentMethods();
      setPaymentMethods(data);
    } catch (error) {
      console.error("Failed to fetch payment methods:", error);
      toast({ 
        title: "Erro ao carregar formas de pagamento",
        variant: "destructive" 
      });
    }
  };

  const loadConfig = async () => {
    try {
      const data = await getConfig();
      if (data) {
        setConfig(data);
        setAdminFee(formatPercentage(data.admin_fee_percentage));
        setManagementFee(formatPercentage(data.management_fee_percentage || 0));
        setLateFee(formatPercentage(data.late_fee_percentage));
        setInterestRate(formatPercentage(data.interest_rate_percentage));
      }
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações.",
        variant: "destructive",
      });
    }
  };

  const fetchLocations = async () => {
    try {
      const data = await locationService.getLocations();
      setLocations(data);
    } catch (error) {
      console.error("Failed to fetch locations:", error);
      toast({ 
        title: "Erro ao carregar locais",
        description: "Não foi possível carregar a lista de locais.",
        variant: "destructive" 
      });
    }
  };

  const handleConfigSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedConfig = {
      ...config,
      admin_fee_percentage: parsePercentageToFloat(adminFee),
      management_fee_percentage: parsePercentageToFloat(managementFee),
      late_fee_percentage: parsePercentageToFloat(lateFee),
      interest_rate_percentage: parsePercentageToFloat(interestRate),
    };
    try {
      await updateConfig(updatedConfig);
      toast({ title: "Configurações salvas com sucesso!" });
    } catch (error) {
      console.error("Erro ao salvar config:", error);
      toast({ title: "Erro ao salvar configurações", variant: "destructive" });
    }
  };

  const handleCepLookup = async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, "");
    if (cleanCep.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      const data = await response.json();

      if (data && !data.erro) {
        setLocationForm((prev) => ({
          ...prev,
          street: data.logradouro,
          neighborhood: data.bairro,
          city: data.localidade,
          state: data.uf,
          is_active: prev.is_active,
        }));
      } else {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP informado.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching CEP:", error);
      toast({
        title: "Erro",
        description: "Não foi possível buscar o CEP.",
        variant: "destructive",
      });
    }
  };

  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingLocation) {
        await locationService.updateLocation(editingLocation.id, {
          name: locationForm.name,
          street: locationForm.street,
          number: locationForm.number,
          complement: locationForm.complement || undefined,
          neighborhood: locationForm.neighborhood,
          city: locationForm.city,
          state: locationForm.state,
          zip_code: locationForm.zip_code,
        });
        toast({
          title: "Sucesso",
          description: "Local atualizado com sucesso.",
        });
      } else {
        await locationService.createLocation({
          name: locationForm.name,
          street: locationForm.street,
          number: locationForm.number,
          complement: locationForm.complement || undefined,
          neighborhood: locationForm.neighborhood,
          city: locationForm.city,
          state: locationForm.state,
          zip_code: locationForm.zip_code,
        });
        toast({
          title: "Sucesso",
          description: "Local cadastrado com sucesso.",
        });
      }

      setIsLocationDialogOpen(false);
      setEditingLocation(null);
      setLocationForm({
        name: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
        is_active: true,
      });
      await fetchLocations();
    } catch (error: any) {
      console.error("Failed to save location:", error);
      toast({
        title: "Erro",
        description: error.message || "Não foi possível salvar o local.",
        variant: "destructive",
      });
    }
  };

  const openLocationDialog = (location?: Location) => {
    if (location) {
      setEditingLocation(location);
      setLocationForm({
        name: location.name,
        street: location.street || "",
        number: location.number || "",
        complement: location.complement || "",
        neighborhood: location.neighborhood || "",
        city: location.city,
        state: location.state,
        zip_code: location.zip_code || "",
        is_active: location.is_active !== false,
      });
    } else {
      setEditingLocation(null);
      setLocationForm({
        name: "",
        street: "",
        number: "",
        complement: "",
        neighborhood: "",
        city: "",
        state: "",
        zip_code: "",
        is_active: true,
      });
    }
    setIsLocationDialogOpen(true);
  };

  const confirmDeleteLocation = async () => {
    if (!locationToDelete) return;

    setLocationToDelete(null);
    setIsLoadingLocations(true);

    try {
      toast({
        title: "Processando...",
        description: "Removendo local do sistema...",
      });

      await locationService.deleteLocation(locationToDelete.id);

      setLocations(prev => prev.filter(loc => loc.id !== locationToDelete.id));

      toast({
        title: "Sucesso!",
        description: "Local excluído com sucesso.",
      });

      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchLocations();

    } catch (error: any) {
      console.error("Error deleting location:", error);
      
      let errorMessage = "Não foi possível excluir o local.";
      
      if (error.message?.includes("propriedades") || 
          error.message?.includes("despesas") || 
          error.message?.includes("permissões")) {
        errorMessage = "Este local não pode ser excluído pois possui propriedades, despesas ou permissões vinculadas.";
      } else if (error.message?.includes("foreign key")) {
        errorMessage = "Este local possui dados vinculados e não pode ser excluído.";
      }

      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });

      await fetchLocations();
    } finally {
      setIsLoadingLocations(false);
    }
  };

  const filteredLocations = locations.filter((location) => {
    const search = searchLocation.toLowerCase();
    return (
      location.name?.toLowerCase().includes(search) ||
      location.city?.toLowerCase().includes(search) ||
      location.neighborhood?.toLowerCase().includes(search)
    );
  });

  const handleResetPassword = async (userId: string) => {
    if (!confirm("Deseja resetar a senha deste usuário para 'mudar123'?")) return;
    try {
      // NOTA: Em produção, isso deve usar bcrypt antes de salvar
      const { error } = await supabase
        .from("system_users")
        .update({ password_hash: "mudar123" })
        .eq("id", userId);

      if (error) throw error;
      toast({ title: "Senha resetada com sucesso! Nova senha: mudar123" });
    } catch (error) {
      console.error("Erro ao resetar senha:", error);
      toast({ title: "Erro ao resetar senha", variant: "destructive" });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      
      try {
        await Promise.all([
          loadConfig(),
          fetchLocations(),
          fetchPaymentMethods()
        ]);
      } catch (err) {
        console.error("Error loading settings data:", err);
      }
    };

    loadData();
  }, [user?.id]);

  return (
    <Layout>
      <div id="settings-page" className="space-y-6">
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Configurações</h1>
              <p className="text-muted-foreground mt-2">
                Gerencie os dados da empresa, usuários e parâmetros do sistema
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setHelpOpen(true)}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="inline-flex h-12 items-center justify-start rounded-lg bg-muted p-1 text-muted-foreground w-full overflow-x-auto">
            <TabsTrigger 
              id="settings-tab-company" 
              value="company" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Dados da Empresa</span>
              <span className="sm:hidden">Empresa</span>
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-payment-methods" 
              value="payment-methods" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Wallet className="h-4 w-4" />
              <span className="hidden sm:inline">Formas Pagamento</span>
              <span className="sm:hidden">Pagamento</span>
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-admin-fees" 
              value="admin-fees" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Percent className="h-4 w-4" />
              <span className="hidden sm:inline">Taxas Admin</span>
              <span className="sm:hidden">Taxas</span>
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-fines" 
              value="fines" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <AlertCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Multas e Juros</span>
              <span className="sm:hidden">Multas</span>
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-users" 
              value="users" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Users className="h-4 w-4" />
              Usuários
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-permissions" 
              value="permissions" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <Shield className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger 
              id="settings-tab-locations" 
              value="locations" 
              className="inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm gap-2"
            >
              <MapPin className="h-4 w-4" />
              Locais
            </TabsTrigger>
          </TabsList>

          {/* DADOS DA EMPRESA */}
          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Dados da Empresa</CardTitle>
                <CardDescription>
                  Informações cadastrais exibidas em relatórios e contratos
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfigSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Razão Social</Label>
                      <Input 
                        id="companyName" 
                        value={config.company_name}
                        onChange={(e) => setConfig({...config, company_name: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cnpj">CNPJ</Label>
                      <Input 
                        id="cnpj" 
                        value={config.cnpj}
                        onChange={(e) => setConfig({...config, cnpj: applyCnpjMask(e.target.value)})}
                        maxLength={18}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">E-mail</Label>
                      <Input 
                        id="email" 
                        type="email"
                        value={config.email}
                        onChange={(e) => setConfig({...config, email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input 
                        id="phone" 
                        value={config.phone}
                        onChange={(e) => setConfig({...config, phone: applyPhoneMask(e.target.value)})}
                        maxLength={15}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="address">Endereço</Label>
                    <Input 
                      id="address" 
                      value={config.address}
                      onChange={(e) => setConfig({...config, address: e.target.value})}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">Cidade</Label>
                      <Input 
                        id="city" 
                        value={config.city}
                        onChange={(e) => setConfig({...config, city: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">Estado</Label>
                      <Input 
                        id="state" 
                        value={config.state}
                        onChange={(e) => setConfig({...config, state: e.target.value})}
                        maxLength={2}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">CEP</Label>
                      <Input 
                        id="zipCode" 
                        value={config.zip_code}
                        onChange={(e) => setConfig({...config, zip_code: applyCepMask(e.target.value)})}
                        maxLength={9}
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button id="settings-company-save" type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Alterações
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FORMAS DE PAGAMENTO */}
          <TabsContent value="payment-methods">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Formas de Pagamento</CardTitle>
                    <CardDescription>
                      Gerencie as formas de pagamento disponíveis no sistema
                    </CardDescription>
                  </div>
                  <Button onClick={() => {
                    setEditingPaymentMethod(null);
                    setPaymentMethodForm({ name: "", code: "", active: true, display_order: paymentMethods.length + 1 });
                    setIsPaymentMethodDialogOpen(true);
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nova Forma
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {paymentMethods.map((method) => (
                    <div key={method.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="text-2xl">{method.display_order}</div>
                        <div>
                          <div className="font-medium">{method.name}</div>
                          <div className="text-sm text-muted-foreground">Código: {method.code}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={method.active ? "default" : "secondary"}>
                          {method.active ? "Ativo" : "Inativo"}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingPaymentMethod(method);
                            setPaymentMethodForm({
                              name: method.name,
                              code: method.code,
                              active: method.active,
                              display_order: method.display_order,
                            });
                            setIsPaymentMethodDialogOpen(true);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={async () => {
                            if (confirm(`Deseja excluir ${method.name}?`)) {
                              try {
                                await deletePaymentMethod(method.id);
                                toast({ title: "Forma de pagamento excluída" });
                                await fetchPaymentMethods();
                              } catch (error) {
                                toast({ title: "Erro ao excluir", variant: "destructive" });
                              }
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TAXAS ADMINISTRATIVAS & GERENCIAMENTO */}
          <TabsContent value="admin-fees">
            <Card>
              <CardHeader>
                <CardTitle>Taxas e Comissões</CardTitle>
                <CardDescription>
                  Configure as taxas cobradas sobre os aluguéis
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfigSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="adminFee" className="flex items-center gap-2">
                        <Percent className="h-4 w-4 text-emerald-600" />
                        Taxa de Administração (%)
                      </Label>
                      <div className="relative">
                        <Input 
                          id="adminFee" 
                          type="text"
                          value={adminFee}
                          onChange={(e) => setAdminFee(e.target.value)}
                          className="pr-8"
                          placeholder="0,000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Incide sobre o valor bruto do aluguel.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="managementFee" className="flex items-center gap-2">
                        <Wallet className="h-4 w-4 text-blue-600" />
                        Taxa de Gerenciamento (%)
                      </Label>
                      <div className="relative">
                        <Input 
                          id="managementFee" 
                          type="text"
                          value={managementFee}
                          onChange={(e) => setManagementFee(e.target.value)}
                          className="pr-8"
                          placeholder="0,000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Taxa adicional para gestão de imóveis (opcional).
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-md border border-amber-200 dark:border-amber-800 mt-4">
                    <div className="flex items-start gap-3">
                      <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">Exemplo de Cálculo</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                          Para um boleto de R$ 1.000,00 com 10 dias de atraso:
                        </p>
                        <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc ml-5 mt-1">
                          <li>Multa ({lateFee}%): R$ {(1000 * (parsePercentageToFloat(lateFee)/100)).toFixed(2)}</li>
                          <li>Juros ({interestRate}% ao dia × 10): R$ {(1000 * (parsePercentageToFloat(interestRate)/100) * 10).toFixed(2)}</li>
                          <li><strong>Total a Pagar: R$ {(1000 * (1 + (parsePercentageToFloat(lateFee)/100) + ((parsePercentageToFloat(interestRate)/100) * 10))).toFixed(2)}</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button id="settings-fees-save" type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Taxas
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* MULTAS E JUROS */}
          <TabsContent value="fines">
            <Card>
              <CardHeader>
                <CardTitle>Multas e Juros</CardTitle>
                <CardDescription>
                  Configuração de encargos para pagamentos em atraso
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleConfigSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="lateFee">Multa por Atraso (%)</Label>
                      <div className="relative">
                        <Input 
                          id="lateFee" 
                          type="text"
                          value={lateFee}
                          onChange={(e) => setLateFee(e.target.value)}
                          className="pr-8"
                          placeholder="0,000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cobrado uma única vez sobre o valor do boleto vencido.
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="interestRate">Juros Diários (%)</Label>
                      <div className="relative">
                        <Input 
                          id="interestRate" 
                          type="text"
                          value={interestRate}
                          onChange={(e) => setInterestRate(applyPercentageMask(e.target.value))}
                          className="pr-8"
                          placeholder="0,000"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Cobrado por dia de atraso (Pro Rata Die).
                      </p>
                    </div>
                  </div>

                  <div className="bg-amber-50 dark:bg-amber-950/20 p-4 rounded-md border border-amber-200 dark:border-amber-800 mt-4">
                    <div className="flex items-start gap-3">
                      <Coins className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-300">Exemplo de Cálculo</p>
                        <p className="text-sm text-amber-700 dark:text-amber-400 mt-1">
                          Para um boleto de R$ 1.000,00 com 10 dias de atraso:
                        </p>
                        <ul className="text-sm text-amber-700 dark:text-amber-400 list-disc ml-5 mt-1">
                          <li>Multa ({lateFee}%): R$ {(1000 * (parsePercentageToFloat(lateFee)/100)).toFixed(2)}</li>
                          <li>Juros ({interestRate}% ao dia × 10): R$ {(1000 * (parsePercentageToFloat(interestRate)/100) * 10).toFixed(2)}</li>
                          <li><strong>Total a Pagar: R$ {(1000 * (1 + (parsePercentageToFloat(lateFee)/100) + ((parsePercentageToFloat(interestRate)/100) * 10))).toFixed(2)}</strong></li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button id="settings-fines-save" type="submit" className="bg-emerald-600 hover:bg-emerald-700">
                      <Save className="h-4 w-4 mr-2" />
                      Salvar Encargos
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          {/* USUÁRIOS */}
          <TabsContent value="users">
            <UsersTab
              users={users}
              isLoading={usersLoading}
              onCreateUser={handleCreateUser}
              onUpdateUser={handleUpdateUser}
              onDeleteUser={async (id) => { await handleDeleteUser(id); return true; }}
              onToggleStatus={async (id) => { const user = users.find(u => u.id === id); if (user) return await handleToggleUserStatus(user); return false; }}
              onResetPassword={async (id) => { await handleResetPassword(id); return true; }}
              onUnblockUser={async (id) => { return await handleUnblockUser(id); }}
            />
          </TabsContent>

          {/* PERMISSÕES */}
          <TabsContent value="permissions">
            <PermissionsTab
              users={users}
              locations={locations}
              roleMenuPermissions={permissions}
              isLoading={permissionsLoading}
              onUpdateRoleMenuPermission={updateRoleMenuPermission}
              onSaveLocationPermissions={saveLocationPermissions}
              onSaveAdminFeeExemptions={saveAdminFeeExemptions}
              onSaveManagementFeeExemptions={saveManagementFeeExemptions}
              getUserLocationPermissions={getUserLocationPermissions}
              getAdminFeeExemptions={getAdminFeeExemptions}
              getManagementFeeExemptions={getManagementFeeExemptions}
            />
          </TabsContent>

          {/* LOCAIS */}
          <TabsContent value="locations" className="space-y-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <MapPin className="h-5 w-5" />
                      Gerenciar Locais
                    </CardTitle>
                    <CardDescription className="mt-1.5">
                      Cadastre locais/condomínios e gerencie contas
                    </CardDescription>
                  </div>
                  <Button id="settings-location-new" onClick={() => setIsLocationDialogOpen(true)} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Novo Local
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Input
                    id="settings-location-search"
                    placeholder="Buscar por nome, cidade ou bairro..."
                    value={searchLocation}
                    onChange={(e) => setSearchLocation(e.target.value)}
                    className="max-w-md"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredLocations.map((location) => (
                    <Card key={location.id} className="relative">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base flex items-start justify-between">
                          <span className="flex-1">{location.name}</span>
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {location.address && (
                            <div className="space-y-0.5">
                              <div>{location.address}</div>
                              {(location.neighborhood || location.city) && (
                                <div>
                                  {[location.neighborhood, location.city]
                                    .filter(Boolean)
                                    .join(" - ")}
                                </div>
                              )}
                              {location.state && location.zip_code && (
                                <div>
                                  {location.state} · CEP {location.zip_code}
                                </div>
                              )}
                            </div>
                          )}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <Button
                          id={`settings-location-expenses-${location.id}`}
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setSelectedLocation(location);
                            setIsExpensesDialogOpen(true);
                          }}
                        >
                          <Wallet className="h-4 w-4 mr-2" />
                          Contas a Pagar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {filteredLocations.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    {searchLocation
                      ? "Nenhum local encontrado com os critérios de busca"
                      : "Nenhum local cadastrado ainda"}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* DIALOG DE LOCAL */}
        <Dialog open={isLocationDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setIsLocationDialogOpen(false);
            setEditingLocation(null);
            setLocationForm({
              name: "",
              street: "",
              number: "",
              complement: "",
              neighborhood: "",
              city: "",
              state: "",
              zip_code: "",
              is_active: true,
            });
          }
        }}>
          <DialogContent id="settings-location-dialog" className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingLocation ? "Editar Local" : "Novo Local"}
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleLocationSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="locationName">Nome do Local <span className="text-red-500">*</span></Label>
                <Input
                  id="locationName"
                  value={locationForm.name}
                  onChange={(e) => setLocationForm({ ...locationForm, name: e.target.value })}
                  placeholder="Ex: Casa 1, Apartamento A, Loja Centro"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationZipCode">CEP <span className="text-red-500">*</span></Label>
                <Input
                  id="locationZipCode"
                  value={locationForm.zip_code}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 8);
                    const formatted = value.replace(/(\d{5})(\d)/, "$1-$2");
                    setLocationForm({ ...locationForm, zip_code: formatted });
                    if (value.length === 8) {
                      handleCepLookup(value);
                    }
                  }}
                  placeholder="00000-000"
                  maxLength={9}
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2 md:col-span-3">
                  <Label htmlFor="locationStreet">Endereço <span className="text-red-500">*</span></Label>
                  <Input
                    id="locationStreet"
                    value={locationForm.street}
                    onChange={(e) => setLocationForm({ ...locationForm, street: e.target.value })}
                    placeholder="Rua, Avenida, etc."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationNumber">Número <span className="text-red-500">*</span></Label>
                  <Input
                    id="locationNumber"
                    value={locationForm.number}
                    onChange={(e) => setLocationForm({ ...locationForm, number: e.target.value })}
                    placeholder="123"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationComplement">Complemento</Label>
                <Input
                  id="locationComplement"
                  value={locationForm.complement}
                  onChange={(e) => setLocationForm({ ...locationForm, complement: e.target.value })}
                  placeholder="Bloco, Andar, Sala, etc."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="locationNeighborhood">Bairro <span className="text-red-500">*</span></Label>
                  <Input
                    id="locationNeighborhood"
                    value={locationForm.neighborhood}
                    onChange={(e) => setLocationForm({ ...locationForm, neighborhood: e.target.value })}
                    placeholder="Centro, Jardins, etc."
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="locationCity">Cidade <span className="text-red-500">*</span></Label>
                  <Input
                    id="locationCity"
                    value={locationForm.city}
                    onChange={(e) => setLocationForm({ ...locationForm, city: e.target.value })}
                    placeholder="São Paulo"
                    required
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  id="settings-location-cancel"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsLocationDialogOpen(false);
                    setEditingLocation(null);
                    setLocationForm({
                      name: "",
                      street: "",
                      number: "",
                      complement: "",
                      neighborhood: "",
                      city: "",
                      state: "",
                      zip_code: "",
                      is_active: true,
                    });
                  }}
                >
                  Cancelar
                </Button>
                <Button id="settings-location-submit" type="submit">
                  {editingLocation ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* ALERT DIALOG PARA CONFIRMAR EXCLUSÃO */}
        <AlertDialog open={!!locationToDelete} onOpenChange={(open) => !open && setLocationToDelete(null)}>
          <AlertDialogContent id="settings-location-delete-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar Exclusão</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja excluir o local <strong>{locationToDelete?.name}</strong>?
                Esta ação não pode ser desfeita.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel id="settings-location-delete-cancel">Cancelar</AlertDialogCancel>
              <Button
                id="settings-location-delete-confirm"
                onClick={(e) => {
                  (e.target as HTMLButtonElement).blur();
                  confirmDeleteLocation();
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* DIALOG DE CONTAS A PAGAR */}
        {selectedLocation && (
          <LocationExpensesDialog
            open={isExpensesDialogOpen}
            onOpenChange={(open) => {
              setIsExpensesDialogOpen(open);
              if (!open) setSelectedLocation(null);
            }}
            location={selectedLocation}
          />
        )}

        {/* DIALOG DE FORMA DE PAGAMENTO */}
        <Dialog open={isPaymentMethodDialogOpen} onOpenChange={setIsPaymentMethodDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingPaymentMethod ? "Editar" : "Nova"} Forma de Pagamento</DialogTitle>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              
              console.log("🔍 [settings] Iniciando salvamento de forma de pagamento...");
              console.log("📋 [settings] Form data:", paymentMethodForm);
              console.log("✏️ [settings] Editando?", !!editingPaymentMethod);
              
              // ✅ Gerar code automaticamente se estiver vazio
              let code = paymentMethodForm.code.trim();
              if (!code && paymentMethodForm.name) {
                code = paymentMethodForm.name.toLowerCase()
                  .normalize('NFD')
                  .replace(/[\u0300-\u036f]/g, '')
                  .replace(/[^a-z0-9\s]/g, '')
                  .replace(/\s+/g, '_')
                  .substring(0, 50);
                console.log("🔧 [settings] Code gerado automaticamente:", code);
              }
              
              // ✅ Validar se code não está vazio
              if (!code) {
                console.error("❌ [settings] Code está vazio!");
                toast({ 
                  title: "Erro de validação", 
                  description: "O código da forma de pagamento é obrigatório.",
                  variant: "destructive" 
                });
                return;
              }
              
              try {
                const dataToSave = {
                  ...paymentMethodForm,
                  code: code,
                };
                
                console.log("💾 [settings] Dados a salvar:", dataToSave);
                
                if (editingPaymentMethod) {
                  console.log("📝 [settings] Atualizando forma de pagamento ID:", editingPaymentMethod.id);
                  await updatePaymentMethod(editingPaymentMethod.id, dataToSave);
                  toast({ title: "Forma de pagamento atualizada" });
                } else {
                  console.log("➕ [settings] Criando nova forma de pagamento");
                  const result = await createPaymentMethod(dataToSave);
                  console.log("✅ [settings] Forma de pagamento criada:", result);
                  toast({ title: "Forma de pagamento criada" });
                }
                setIsPaymentMethodDialogOpen(false);
                await fetchPaymentMethods();
              } catch (error: any) {
                console.error("❌ [settings] Erro ao salvar forma de pagamento:", error);
                console.error("❌ [settings] Error details:", error.message, error.details);
                toast({ 
                  title: "Erro ao salvar", 
                  description: error.message || "Não foi possível salvar a forma de pagamento.",
                  variant: "destructive" 
                });
              }
            }} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="paymentMethodName">Nome *</Label>
                <Input
                  id="paymentMethodName"
                  value={paymentMethodForm.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    setPaymentMethodForm({ 
                      ...paymentMethodForm, 
                      name: name,
                      // ✅ Auto-preencher code baseado no name (apenas se for novo)
                      code: editingPaymentMethod ? paymentMethodForm.code : name.toLowerCase()
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '')
                        .replace(/[^a-z0-9\s]/g, '')
                        .replace(/\s+/g, '_')
                        .substring(0, 50)
                    });
                  }}
                  placeholder="Ex: PIX, Dinheiro, Boleto"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="paymentMethodCode">Código *</Label>
                <Input
                  id="paymentMethodCode"
                  value={paymentMethodForm.code}
                  onChange={(e) => setPaymentMethodForm({ 
                    ...paymentMethodForm, 
                    code: e.target.value.toLowerCase()
                      .normalize('NFD')
                      .replace(/[\u0300-\u036f]/g, '')
                      .replace(/[^a-z0-9_]/g, '')
                      .substring(0, 50)
                  })}
                  placeholder="Ex: pix, dinheiro, boleto"
                  required
                  disabled={!!editingPaymentMethod}
                />
                <p className="text-sm text-muted-foreground">
                  {editingPaymentMethod 
                    ? "Código único (não pode ser alterado)"
                    : "Gerado automaticamente do nome (pode editar antes de salvar)"
                  }
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="paymentMethodOrder">Ordem de Exibição</Label>
                <Input
                  id="paymentMethodOrder"
                  type="number"
                  value={paymentMethodForm.display_order}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, display_order: parseInt(e.target.value) || 0 })}
                  min="1"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="paymentMethodActive"
                  checked={paymentMethodForm.active}
                  onChange={(e) => setPaymentMethodForm({ ...paymentMethodForm, active: e.target.checked })}
                  className="h-4 w-4 rounded"
                />
                <Label htmlFor="paymentMethodActive" className="cursor-pointer">Ativo</Label>
              </div>
              
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsPaymentMethodDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">
                  {editingPaymentMethod ? "Atualizar" : "Criar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} page="settings" />

        {/* Link para Manual */}
        <div className="fixed bottom-4 right-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.open('/manual.html', '_blank')}
            className="shadow-lg"
          >
            <FileText className="h-4 w-4 mr-2" />
            Manual do Sistema
          </Button>
        </div>
      </div>
    </Layout>
  );
}