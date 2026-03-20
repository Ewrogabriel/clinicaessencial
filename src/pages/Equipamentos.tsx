import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useI18n } from "@/modules/shared/hooks/useI18n";
import { toast } from "sonner";
import { format, isPast, addDays, isWithinInterval } from "date-fns";
import { Plus, Wrench, Package, AlertTriangle, Edit2, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { downloadEquipamentosPDF } from "@/lib/generateEquipamentosPDF";

interface Equipamento {
  id: string;
  nome: string;
  marca: string | null;
  modelo: string | null;
  cor: string | null;
  quantidade: number;
  descricao: string | null;
  tipo: string;
  e_consumo: boolean;
  estoque_atual: number;
  estoque_minimo: number;
  data_aquisicao: string | null;
  data_ultima_revisao: string | null;
  data_proxima_revisao: string | null;
  observacoes_manutencao: string | null;
  status: string;
  foto_url: string | null;
  valor: number | null;
  created_at: string;
}

const emptyForm = {
  nome: "", marca: "", modelo: "", cor: "", quantidade: 1, descricao: "",
  tipo: "equipamento", e_consumo: false, estoque_atual: 0, estoque_minimo: 0,
  data_aquisicao: "", data_ultima_revisao: "", data_proxima_revisao: "",
  observacoes_manutencao: "", status: "ativo", valor: 0,
};

export default function Equipamentos() {
  const { t } = useI18n();
  const { user, isAdmin, isGestor, isMaster } = useAuth();
  const { activeClinicId } = useClinic();
  const canEdit = isAdmin || isGestor || isMaster;
  const [items, setItems] = useState<Equipamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tab, setTab] = useState("todos");

  const fetchItems = async () => {
    setLoading(true);
    let query = supabase.from("equipamentos").select("*").order("nome");
    if (activeClinicId) query = query.eq("clinic_id", activeClinicId);
    const { data, error } = await query;
    if (error) { toast.error("Erro ao carregar equipamentos"); console.error(error); }
    else setItems((data as unknown as Equipamento[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [activeClinicId]);

  const handleSave = async () => {
    if (!form.nome.trim()) { toast.error("Nome é obrigatório"); return; }
    const payload: Record<string, unknown> = {
      ...form,
      marca: form.marca || null, modelo: form.modelo || null, cor: form.cor || null,
      descricao: form.descricao || null, observacoes_manutencao: form.observacoes_manutencao || null,
      data_aquisicao: form.data_aquisicao || null,
      data_ultima_revisao: form.data_ultima_revisao || null,
      data_proxima_revisao: form.data_proxima_revisao || null,
      clinic_id: activeClinicId || null,
      created_by: user?.id,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from("equipamentos").update(payload as any).eq("id", editingId));
    } else {
      ({ error } = await supabase.from("equipamentos").insert(payload as any));
    }
    if (error) { toast.error("Erro ao salvar"); console.error(error); return; }
    toast.success(editingId ? "Atualizado!" : "Cadastrado!");
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Deseja excluir este item?")) return;
    const { error } = await supabase.from("equipamentos").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    toast.success("Excluído!");
    fetchItems();
  };

  const openEdit = (item: Equipamento) => {
    setEditingId(item.id);
    setForm({
      nome: item.nome, marca: item.marca || "", modelo: item.modelo || "",
      cor: item.cor || "", quantidade: item.quantidade, descricao: item.descricao || "",
      tipo: item.tipo, e_consumo: item.e_consumo, estoque_atual: item.estoque_atual,
      estoque_minimo: item.estoque_minimo, data_aquisicao: item.data_aquisicao || "",
      data_ultima_revisao: item.data_ultima_revisao || "",
      data_proxima_revisao: item.data_proxima_revisao || "",
      observacoes_manutencao: item.observacoes_manutencao || "", status: item.status,
      valor: Number(item.valor) || 0,
    });
    setDialogOpen(true);
  };

  const filtered = items.filter((i) => {
    const matchSearch = !search || i.nome.toLowerCase().includes(search.toLowerCase()) ||
      (i.marca || "").toLowerCase().includes(search.toLowerCase());
    if (tab === "consumo") return matchSearch && i.e_consumo;
    if (tab === "equipamentos") return matchSearch && !i.e_consumo;
    if (tab === "manutencao") return matchSearch && i.data_proxima_revisao &&
      (isPast(new Date(i.data_proxima_revisao)) || isWithinInterval(new Date(i.data_proxima_revisao), { start: new Date(), end: addDays(new Date(), 30) }));
    return matchSearch;
  });

  const reviewAlerts = items.filter((i) => i.data_proxima_revisao && isPast(new Date(i.data_proxima_revisao))).length;
  const lowStock = items.filter((i) => i.e_consumo && i.estoque_atual <= i.estoque_minimo).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("equip.title")}</h1>
          <p className="text-sm text-muted-foreground">Gerencie aparelhos, recursos e materiais de consumo</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => downloadEquipamentosPDF(items)} variant="outline" className="gap-2">
            <Package className="h-4 w-4" /> Extrair Lista PDF
          </Button>
          {canEdit && (
            <Button onClick={() => { setEditingId(null); setForm(emptyForm); setDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" /> {t("equip.add")}
            </Button>
          )}
        </div>
      </div>

      {(reviewAlerts > 0 || lowStock > 0) && (
        <div className="flex gap-3 flex-wrap">
          {reviewAlerts > 0 && (
            <Badge variant="destructive" className="gap-1 text-sm py-1 px-3">
              <AlertTriangle className="h-3.5 w-3.5" /> {reviewAlerts} {t("equip.review_overdue")}
            </Badge>
          )}
          {lowStock > 0 && (
            <Badge variant="outline" className="gap-1 text-sm py-1 px-3 border-orange-400 text-orange-600">
              <Package className="h-3.5 w-3.5" /> {lowStock} {t("equip.low_stock_alert")}
            </Badge>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="todos">Todos ({items.length})</TabsTrigger>
          <TabsTrigger value="equipamentos">Aparelhos ({items.filter(i => !i.e_consumo).length})</TabsTrigger>
          <TabsTrigger value="consumo">Consumo ({items.filter(i => i.e_consumo).length})</TabsTrigger>
          <TabsTrigger value="manutencao" className="gap-1">
            <Wrench className="h-3.5 w-3.5" /> Manutenção
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("common.name")}</TableHead>
                    <TableHead>{t("equip.brand")} / {t("equip.model")}</TableHead>
                    <TableHead>{t("equip.type")}</TableHead>
                    <TableHead className="text-center">{t("common.quantity")}</TableHead>
                    <TableHead>{t("equip.value")}</TableHead>
                    <TableHead className="text-center">Estoque</TableHead>
                    <TableHead>{t("equip.next_review")}</TableHead>
                    <TableHead>{t("common.status")}</TableHead>
                    <TableHead className="text-right">{t("common.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common.loading")}</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">{t("common.no_data")}</TableCell></TableRow>
                  ) : filtered.map((item) => {
                    const reviewOverdue = item.data_proxima_revisao && isPast(new Date(item.data_proxima_revisao));
                    const reviewSoon = item.data_proxima_revisao && !reviewOverdue &&
                      isWithinInterval(new Date(item.data_proxima_revisao), { start: new Date(), end: addDays(new Date(), 30) });
                    const stockLow = item.e_consumo && item.estoque_atual <= item.estoque_minimo;

                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="font-medium">{item.nome}</div>
                          {item.cor && <span className="text-xs text-muted-foreground">{item.cor}</span>}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {[item.marca, item.modelo].filter(Boolean).join(" / ") || "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.e_consumo ? "secondary" : "outline"}>
                            {item.e_consumo ? t("equip.consumable") : t(`equip.${item.tipo}`)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.quantidade}</TableCell>
                        <TableCell className="text-right">R$ {(Number(item.valor) || 0).toFixed(2)}</TableCell>
                        <TableCell className="text-center">
                          {item.e_consumo ? (
                            <span className={stockLow ? "text-orange-600 font-semibold" : ""}>
                              {item.estoque_atual} {stockLow && "⚠"}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {item.data_proxima_revisao ? (
                            <span className={reviewOverdue ? "text-destructive font-semibold" : reviewSoon ? "text-orange-600" : ""}>
                              {format(new Date(item.data_proxima_revisao), "dd/MM/yyyy")}
                              {reviewOverdue && " ⚠"}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={item.status === "ativo" ? "default" : item.status === "em_manutencao" ? "secondary" : "destructive"}>
                            {item.status === "ativo" ? t("common.active") : item.status === "em_manutencao" ? "Manutenção" : t("common.inactive")}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            {canEdit && (
                              <>
                                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}><Edit2 className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={canEdit && dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? t("common.edit") : t("equip.add")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("common.name")} *</Label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("equip.brand")}</Label>
              <Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("equip.model")}</Label>
              <Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("equip.color")}</Label>
              <Input value={form.cor} onChange={(e) => setForm({ ...form, cor: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("equip.type")}</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="equipamento">{t("equip.equipment")}</SelectItem>
                  <SelectItem value="consumo">{t("equip.consumable")}</SelectItem>
                  <SelectItem value="mobiliario">{t("equip.furniture")}</SelectItem>
                  <SelectItem value="ferramenta">{t("equip.tool")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("common.quantity")}</Label>
              <Input type="number" min={0} value={form.quantidade} onChange={(e) => setForm({ ...form, quantidade: Number(e.target.value) })} />
            </div>
            <div className="flex items-center gap-3 col-span-full">
              <Switch checked={form.e_consumo} onCheckedChange={(v) => setForm({ ...form, e_consumo: v })} />
              <Label>{t("equip.is_consumable")}</Label>
            </div>
            {form.e_consumo && (
              <>
                <div className="space-y-2">
                  <Label>{t("equip.current_stock")}</Label>
                  <Input type="number" min={0} value={form.estoque_atual} onChange={(e) => setForm({ ...form, estoque_atual: Number(e.target.value) })} />
                </div>
                <div className="space-y-2">
                  <Label>{t("equip.min_stock")}</Label>
                  <Input type="number" min={0} value={form.estoque_minimo} onChange={(e) => setForm({ ...form, estoque_minimo: Number(e.target.value) })} />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label>{t("equip.acquisition_date")}</Label>
              <Input type="date" value={form.data_aquisicao} onChange={(e) => setForm({ ...form, data_aquisicao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("common.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">{t("common.active")}</SelectItem>
                  <SelectItem value="em_manutencao">Em Manutenção</SelectItem>
                  <SelectItem value="inativo">{t("common.inactive")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("equip.last_review")}</Label>
              <Input type="date" value={form.data_ultima_revisao} onChange={(e) => setForm({ ...form, data_ultima_revisao: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{t("equip.next_review")}</Label>
              <Input type="date" value={form.data_proxima_revisao} onChange={(e) => setForm({ ...form, data_proxima_revisao: e.target.value })} />
            </div>
            <div className="space-y-2 col-span-full">
              <Label>{t("common.description")}</Label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} rows={2} />
            </div>
            <div className="space-y-2 col-span-full">
              <Label>{t("equip.value")}</Label>
              <Input type="number" min={0} step="0.01" value={form.valor} onChange={(e) => setForm({ ...form, valor: Number(e.target.value) })} />
            </div>
            <div className="space-y-2 col-span-full">
              <Label>{t("equip.maintenance_notes")}</Label>
              <Textarea value={form.observacoes_manutencao} onChange={(e) => setForm({ ...form, observacoes_manutencao: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleSave}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
