import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { Bell, BellOff, Plus, Trash2, TrendingUp, TrendingDown, ArrowUpDown, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

export default function Alertas() {
  const { user, isAuthenticated } = useAuth();
  const utils = trpc.useUtils();

  const { data: alerts, isLoading: alertsLoading } = trpc.alerts.list.useQuery(undefined, { enabled: isAuthenticated });
  const { data: triggered, isLoading: triggeredLoading } = trpc.alerts.triggered.useQuery(undefined, { enabled: isAuthenticated });
  const { data: products } = trpc.products.list.useQuery();

  const [newProductId, setNewProductId] = useState<string>("");
  const [newThreshold, setNewThreshold] = useState<string>("5");
  const [newDirection, setNewDirection] = useState<string>("both");

  const createAlert = trpc.alerts.create.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      toast.success("Alerta criado com sucesso!");
      setNewProductId("");
      setNewThreshold("5");
      setNewDirection("both");
    },
    onError: (err) => toast.error(`Erro ao criar alerta: ${err.message}`),
  });

  const deleteAlert = trpc.alerts.delete.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      toast.success("Alerta removido.");
    },
  });

  const toggleAlert = trpc.alerts.toggle.useMutation({
    onSuccess: () => {
      utils.alerts.list.invalidate();
      toast.success("Status do alerta atualizado.");
    },
  });

  const handleCreate = () => {
    if (!newProductId || !newThreshold) {
      toast.error("Selecione um produto e defina o limite.");
      return;
    }
    createAlert.mutate({
      productId: Number(newProductId),
      thresholdPercent: Number(newThreshold),
      direction: newDirection as "up" | "down" | "both",
    });
  };

  const directionLabel = (d: string) => {
    if (d === "up") return { label: "Alta", icon: TrendingUp, color: "text-red-600" };
    if (d === "down") return { label: "Queda", icon: TrendingDown, color: "text-emerald-600" };
    return { label: "Ambos", icon: ArrowUpDown, color: "text-[#003770]" };
  };

  if (!isAuthenticated) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas de Preço</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure alertas personalizados para monitorar variações de preço</p>
        </div>
        <Card>
          <CardContent className="py-16 text-center">
            <Bell className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Faça login para configurar alertas</h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-md mx-auto">
              O sistema de alertas permite que você configure limites de variação de preço para cada produto e receba notificações quando esses limites forem ultrapassados.
            </p>
            <Button onClick={() => { window.location.href = getLoginUrl(); }} className="bg-[#EE7D00] hover:bg-[#d56e00] text-white">
              Entrar no Sistema
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas de Preço</h1>
          <p className="text-muted-foreground text-sm mt-1">Configure limites de variação e receba notificações automáticas</p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button className="bg-[#003770] hover:bg-[#002550] text-white gap-2">
              <Plus className="h-4 w-4" /> Novo Alerta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Criar Novo Alerta</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={newProductId} onValueChange={setNewProductId}>
                  <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                  <SelectContent>
                    {(products as any[] || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name} ({p.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Limite de Variação (%)</Label>
                <Input
                  type="number"
                  min="0.1"
                  max="100"
                  step="0.5"
                  value={newThreshold}
                  onChange={(e) => setNewThreshold(e.target.value)}
                  placeholder="Ex: 5"
                />
                <p className="text-xs text-muted-foreground">Alerta será disparado quando a variação ultrapassar este percentual</p>
              </div>
              <div className="space-y-2">
                <Label>Direção</Label>
                <Select value={newDirection} onValueChange={setNewDirection}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Ambos (alta e queda)</SelectItem>
                    <SelectItem value="up">Apenas alta</SelectItem>
                    <SelectItem value="down">Apenas queda</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancelar</Button>
              </DialogClose>
              <DialogClose asChild>
                <Button onClick={handleCreate} className="bg-[#003770] hover:bg-[#002550] text-white" disabled={createAlert.isPending}>
                  {createAlert.isPending ? "Criando..." : "Criar Alerta"}
                </Button>
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Triggered Alerts */}
      {triggered && (triggered as any[]).length > 0 && (
        <Card className="border-red-200 bg-red-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" /> Alertas Disparados
            </CardTitle>
            <p className="text-xs text-red-600/70">Produtos que ultrapassaram os limites configurados</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(triggered as any[]).map((t: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-3 bg-white rounded-lg border border-red-100">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-red-100">
                      <Bell className="h-4 w-4 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        Limite: {Number(t.thresholdPercent).toFixed(1)}% | Variação atual: {Number(t.currentVariation).toFixed(2)}%
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    Disparado
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Meus Alertas</CardTitle>
          <p className="text-xs text-muted-foreground">Gerencie seus alertas de variação de preço — ative/desative ou exclua conforme necessário</p>
        </CardHeader>
        <CardContent>
          {alertsLoading ? <Skeleton className="h-[200px] w-full" /> : (
            <>
              {(!alerts || (alerts as any[]).length === 0) ? (
                <div className="py-12 text-center">
                  <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-muted-foreground text-sm">Nenhum alerta configurado.</p>
                  <p className="text-muted-foreground text-xs mt-1">Clique em "Novo Alerta" para começar a monitorar variações de preço.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {(alerts as any[]).map((alert: any) => {
                    const dir = directionLabel(alert.direction);
                    const DirIcon = dir.icon;
                    return (
                      <div key={alert.id} className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${alert.isActive ? "bg-white hover:bg-muted/30" : "bg-muted/20 opacity-60"}`}>
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${alert.isActive ? "bg-[#003770]/10" : "bg-gray-100"}`}>
                            {alert.isActive ? <Bell className="h-4 w-4 text-[#003770]" /> : <BellOff className="h-4 w-4 text-gray-400" />}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{alert.productName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className="text-xs gap-1">
                                <DirIcon className={`h-3 w-3 ${dir.color}`} />
                                {dir.label}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                Limite: <strong>{Number(alert.thresholdPercent).toFixed(1)}%</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Switch
                            checked={!!alert.isActive}
                            onCheckedChange={() => toggleAlert.mutate({ alertId: alert.id })}
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-red-600"
                            onClick={() => deleteAlert.mutate({ alertId: alert.id })}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Alert Configuration Guide */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Como Funcionam os Alertas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-[#003770]/10 w-fit">
                <TrendingUp className="h-5 w-5 text-[#003770]" />
              </div>
              <h4 className="font-semibold text-sm">Monitoramento Contínuo</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O sistema compara automaticamente o preço atual com o preço anterior de cada produto, calculando a variação percentual em tempo real.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-[#EE7D00]/10 w-fit">
                <Bell className="h-5 w-5 text-[#EE7D00]" />
              </div>
              <h4 className="font-semibold text-sm">Limites Configuráveis</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Defina o percentual de variação que dispara o alerta e a direção (alta, queda ou ambos). Cada produto pode ter múltiplos alertas com limites diferentes.
              </p>
            </div>
            <div className="space-y-2">
              <div className="p-2 rounded-lg bg-red-50 w-fit">
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
              <h4 className="font-semibold text-sm">Notificações Imediatas</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Quando um produto ultrapassa o limite configurado, o alerta aparece na seção "Alertas Disparados" para ação imediata da equipe de compras.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
