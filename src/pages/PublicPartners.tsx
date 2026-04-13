import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Globe, Phone, Instagram, Mail, MapPin, Handshake, Send, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function PublicPartners() {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({
    nome: "",
    empresa: "",
    telefone: "",
    email: "",
    categoria: "",
    mensagem: "",
  });

  const { data: parceiros = [], isLoading } = useQuery({
    queryKey: ["public-parceiros"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("convenios")
        .select("id, nome, descricao, telefone, whatsapp, email, site, instagram, endereco, imagem_card_url, categoria")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!form.nome.trim() || !form.email.trim()) throw new Error("Nome e email são obrigatórios");
      const { error } = await (supabase as any)
        .from("partner_applications")
        .insert({
          nome: form.nome.trim(),
          empresa: form.empresa.trim() || null,
          telefone: form.telefone.trim() || null,
          email: form.email.trim(),
          categoria: form.categoria.trim() || null,
          mensagem: form.mensagem.trim() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      setSubmitted(true);
      setShowForm(false);
      toast.success("Solicitação enviada com sucesso!");
    },
    onError: (e: Error) => toast.error("Erro ao enviar", { description: e.message }),
  });

  const formatWhatsApp = (phone: string) => {
    const clean = phone.replace(/\D/g, "");
    return `https://wa.me/55${clean}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-teal-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <Handshake className="h-12 w-12 mx-auto mb-4 opacity-90" />
          <h1 className="text-3xl font-bold mb-2">Nossos Parceiros</h1>
          <p className="text-emerald-100 max-w-lg mx-auto">
            Conheça as empresas que fazem parte da nossa rede de parceiros e aproveite benefícios exclusivos.
          </p>
          <Button
            onClick={() => setShowForm(true)}
            variant="secondary"
            className="mt-6 gap-2"
            size="lg"
          >
            <Send className="h-4 w-4" />
            Quero ser Parceiro
          </Button>
        </div>
      </div>

      {/* Partners Grid */}
      <div className="max-w-6xl mx-auto px-4 py-10">
        {isLoading ? (
          <div className="text-center text-muted-foreground py-20">Carregando parceiros...</div>
        ) : parceiros.length === 0 ? (
          <div className="text-center text-muted-foreground py-20">Nenhum parceiro cadastrado ainda.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {parceiros.map((p: any) => (
              <Card key={p.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                {p.imagem_card_url && (
                  <div className="h-40 overflow-hidden">
                    <img src={p.imagem_card_url} alt={p.nome} className="w-full h-full object-cover" />
                  </div>
                )}
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{p.nome}</CardTitle>
                    {p.categoria && (
                      <Badge variant="outline" className="text-xs shrink-0">{p.categoria}</Badge>
                    )}
                  </div>
                  {p.descricao && (
                    <CardDescription className="line-clamp-3">{p.descricao}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex flex-wrap gap-2">
                    {p.whatsapp && (
                      <a href={formatWhatsApp(p.whatsapp)} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                          <Phone className="h-3 w-3" /> WhatsApp
                        </Button>
                      </a>
                    )}
                    {p.site && (
                      <a href={p.site.startsWith("http") ? p.site : `https://${p.site}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                          <Globe className="h-3 w-3" /> Site
                        </Button>
                      </a>
                    )}
                    {p.instagram && (
                      <a href={`https://instagram.com/${p.instagram.replace("@", "")}`} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                          <Instagram className="h-3 w-3" /> Instagram
                        </Button>
                      </a>
                    )}
                    {p.email && (
                      <a href={`mailto:${p.email}`}>
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                          <Mail className="h-3 w-3" /> Email
                        </Button>
                      </a>
                    )}
                  </div>
                  {p.endereco && (
                    <p className="text-xs text-muted-foreground mt-3 flex items-start gap-1">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> {p.endereco}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Success message */}
      {submitted && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-6 text-center">
              <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
              <h2 className="text-xl font-bold mb-2">Solicitação Enviada!</h2>
              <p className="text-muted-foreground mb-6">
                Obrigado pelo interesse em se tornar nosso parceiro. Entraremos em contato em breve!
              </p>
              <Button onClick={() => setSubmitted(false)}>Fechar</Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Application Form */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              Quero ser Parceiro
            </DialogTitle>
            <DialogDescription>
              Preencha os dados abaixo e entraremos em contato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Nome completo *</Label>
              <Input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input
                value={form.empresa}
                onChange={(e) => setForm({ ...form, empresa: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Email *</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Telefone</Label>
                <Input
                  value={form.telefone}
                  onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Categoria / Área de atuação</Label>
              <Input
                value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                placeholder="Ex: Nutrição, Estética, etc."
              />
            </div>
            <div className="space-y-1.5">
              <Label>Mensagem</Label>
              <Textarea
                value={form.mensagem}
                onChange={(e) => setForm({ ...form, mensagem: e.target.value })}
                placeholder="Conte um pouco sobre sua empresa e como gostaria de ser parceiro..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button
              onClick={() => submitMutation.mutate()}
              disabled={submitMutation.isPending || !form.nome.trim() || !form.email.trim()}
              className="gap-2"
            >
              <Send className="h-4 w-4" />
              {submitMutation.isPending ? "Enviando..." : "Enviar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
