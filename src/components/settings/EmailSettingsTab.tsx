import { useState, useEffect } from "react";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  getEmailSettings,
  updateEmailSetting,
  type EmailSetting,
  type EmailType,
  EMAIL_TYPE_LABELS,
  EMAIL_TYPE_ICONS,
} from "@/services/emailSettingsService";

export function EmailSettingsTab() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<EmailSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<EmailType | null>(null);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const data = await getEmailSettings();
      setSettings(data);
    } catch (error) {
      console.error("Erro ao carregar configurações:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as configurações de e-mail.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggle = async (emailType: EmailType, currentStatus: boolean) => {
    try {
      setUpdating(emailType);
      await updateEmailSetting(emailType, !currentStatus);
      
      // Atualizar estado local
      setSettings((prev) =>
        prev.map((setting) =>
          setting.email_type === emailType
            ? { ...setting, enabled: !currentStatus }
            : setting
        )
      );

      toast({
        title: "Configuração atualizada",
        description: `${EMAIL_TYPE_LABELS[emailType]} ${!currentStatus ? "ativado" : "desativado"}.`,
      });
    } catch (error) {
      console.error("Erro ao atualizar configuração:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar a configuração.",
        variant: "destructive",
      });
    } finally {
      setUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Configurações de E-mail</h2>
          <p className="text-sm text-slate-600 mt-1">
            Controle quais e-mails automáticos o sistema deve enviar
          </p>
        </div>
        <Button
          onClick={loadSettings}
          variant="outline"
          size="sm"
          className="gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4">
        {settings.map((setting) => {
          const isUpdating = updating === setting.email_type;
          const icon = EMAIL_TYPE_ICONS[setting.email_type as EmailType];
          const label = EMAIL_TYPE_LABELS[setting.email_type as EmailType];

          return (
            <Card key={setting.id} className="border-slate-200">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-xl">
                      {icon}
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold text-slate-900">
                        {label}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {setting.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {isUpdating && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    <Switch
                      id={`email-${setting.email_type}`}
                      checked={setting.enabled}
                      onCheckedChange={() =>
                        handleToggle(setting.email_type as EmailType, setting.enabled)
                      }
                      disabled={isUpdating}
                    />
                    <Label
                      htmlFor={`email-${setting.email_type}`}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {setting.enabled ? (
                        <span className="text-green-700">Ativo</span>
                      ) : (
                        <span className="text-slate-500">Inativo</span>
                      )}
                    </Label>
                  </div>
                </div>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      <Card className="border-amber-200 bg-amber-50">
        <CardHeader>
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-amber-700 mt-0.5" />
            <div>
              <CardTitle className="text-sm font-semibold text-amber-900">
                ℹ️ Informações Importantes
              </CardTitle>
              <CardDescription className="text-xs text-amber-800 mt-2 space-y-1">
                <p>• Os e-mails são enviados via <strong>Resend</strong> (serviço profissional)</p>
                <p>• Desativar um tipo de e-mail interrompe imediatamente seu envio</p>
                <p>• Em ambiente de desenvolvimento, os links aparecem no console do navegador</p>
                <p>• Recomendamos manter todos os e-mails ativos para melhor experiência do usuário</p>
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}