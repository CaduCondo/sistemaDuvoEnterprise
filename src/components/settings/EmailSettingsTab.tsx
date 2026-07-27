import { useState, useEffect } from "react";
import { Loader2, Mail, RefreshCw, Edit3, Eye, RotateCcw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  getEmailSettings,
  updateEmailSetting,
  getEmailTemplate,
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
  
  // Editor de template
  const [editingTemplate, setEditingTemplate] = useState<EmailType | null>(null);
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const [availableVariables, setAvailableVariables] = useState<string[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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

  // Verificar se o template está configurado (tem subject e body preenchidos)
  const isTemplateConfigured = (setting: EmailSetting): boolean => {
    return !!(setting.email_subject && setting.email_body);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleToggle = async (id: string, emailType: EmailType, currentStatus: boolean) => {
    try {
      setUpdating(emailType);
      await updateEmailSetting(id, { enabled: !currentStatus });
      
      // Atualizar estado local
      setSettings((prev) =>
        prev.map((setting) =>
          setting.id === id
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

  const handleEditTemplate = async (emailType: EmailType) => {
    try {
      const template = await getEmailTemplate(emailType);
      if (template) {
        setTemplateSubject(template.subject);
        setTemplateBody(template.body);
        setAvailableVariables(template.variables);
        setEditingTemplate(emailType);
      }
    } catch (error) {
      console.error("Erro ao carregar template:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar o template.",
        variant: "destructive",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingTemplate) return;

    try {
      setSavingTemplate(true);
      const setting = settings.find(s => s.email_type === editingTemplate);
      
      if (!setting) {
        throw new Error("Configuração não encontrada");
      }

      await updateEmailSetting(setting.id, {
        email_subject: templateSubject,
        email_body: templateBody,
      });

      toast({
        title: "Template salvo!",
        description: "As alterações foram salvas com sucesso.",
      });

      setEditingTemplate(null);
    } catch (error) {
      console.error("Erro ao salvar template:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar o template.",
        variant: "destructive",
      });
    } finally {
      setSavingTemplate(false);
    }
  };

  const insertVariable = (variable: string) => {
    setTemplateBody((prev) => prev + " " + variable);
  };

  const getPreviewHTML = () => {
    let preview = templateBody;
    
    // Substituir variáveis por valores de exemplo
    const examples: Record<string, string> = {
      "{{nome}}": "João Silva",
      "{{email}}": "joao@exemplo.com",
      "{{senha}}": "SenhaTemp123!",
      "{{link}}": "https://duvoenterprise.com.br/redefinir-senha?token=xxx",
      "{{imovel}}": "Apartamento 101 - Edifício Central",
      "{{valor}}": "R$ 2.500,00",
      "{{data_vencimento}}": "05/08/2026",
      "{{data_pagamento}}": "03/08/2026",
      "{{dias}}": "5",
      "{{dias_atraso}}": "3",
    };

    Object.entries(examples).forEach(([variable, value]) => {
      preview = preview.replaceAll(variable, `<strong style="color: #2563eb;">${value}</strong>`);
    });

    return preview;
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
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-base font-semibold text-slate-900">
                          {label}
                        </CardTitle>
                        {isTemplateConfigured(setting) ? (
                          <Badge className="bg-green-600 hover:bg-green-700 text-white text-xs">
                            ✓ Configurado
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-xs">
                            ⚠ Não Configurado
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-xs">
                        {setting.description}
                      </CardDescription>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditTemplate(setting.email_type as EmailType)}
                      className="gap-2"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      Editar Template
                    </Button>

                    {isUpdating && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                    )}
                    <Switch
                      id={`email-${setting.email_type}`}
                      checked={setting.enabled}
                      onCheckedChange={() =>
                        handleToggle(setting.id, setting.email_type as EmailType, setting.enabled)
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

      {/* Dialog de Edição de Template */}
      <Dialog open={editingTemplate !== null} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit3 className="h-5 w-5" />
              Editar Template de E-mail
            </DialogTitle>
            <DialogDescription>
              {editingTemplate && EMAIL_TYPE_LABELS[editingTemplate]}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Variáveis Disponíveis */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-sm font-semibold text-blue-900 mb-2">📌 Variáveis Disponíveis:</p>
              <div className="flex flex-wrap gap-2">
                {availableVariables.map((variable) => (
                  <Badge
                    key={variable}
                    variant="secondary"
                    className="cursor-pointer hover:bg-blue-200"
                    onClick={() => insertVariable(variable)}
                  >
                    {variable}
                  </Badge>
                ))}
              </div>
              <p className="text-xs text-blue-700 mt-2">
                💡 Clique em uma variável para inseri-la no corpo do e-mail
              </p>
            </div>

            {/* Assunto */}
            <div className="space-y-2">
              <Label htmlFor="email-subject">Assunto do E-mail</Label>
              <Input
                id="email-subject"
                value={templateSubject}
                onChange={(e) => setTemplateSubject(e.target.value)}
                placeholder="Ex: Bem-vindo ao D'Uvo Enterprise!"
              />
            </div>

            {/* Corpo */}
            <div className="space-y-2">
              <Label htmlFor="email-body">Corpo do E-mail (HTML)</Label>
              <Textarea
                id="email-body"
                value={templateBody}
                onChange={(e) => setTemplateBody(e.target.value)}
                rows={12}
                className="font-mono text-sm"
                placeholder="<p>Olá {{nome}},</p><p>Seu conteúdo aqui...</p>"
              />
              <p className="text-xs text-slate-500">
                Você pode usar HTML para formatar o e-mail. Use as variáveis acima para personalizar.
              </p>
            </div>

            {/* Preview */}
            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreview(!showPreview)}
                className="gap-2 mb-3"
              >
                <Eye className="h-4 w-4" />
                {showPreview ? "Ocultar Preview" : "Visualizar Preview"}
              </Button>

              {showPreview && (
                <div className="bg-slate-50 border rounded-lg p-4">
                  <p className="text-sm font-semibold mb-2">Assunto: {templateSubject}</p>
                  <div
                    className="prose prose-sm max-w-none"
                    dangerouslySetInnerHTML={{ __html: getPreviewHTML() }}
                  />
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingTemplate(null)}
              disabled={savingTemplate}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={savingTemplate}
              className="gap-2"
            >
              {savingTemplate ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar Template"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}