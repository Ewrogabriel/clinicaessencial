import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Activity, Send, Mail, Instagram, CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const ContactSection = () => {
  const [formData, setFormData] = useState({ nome: "", email: "", telefone: "", mensagem: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome || !formData.email) {
      toast({ title: "Preencha nome e email", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.from("contact_submissions").insert({
        nome: formData.nome,
        email: formData.email,
        telefone: formData.telefone || null,
        mensagem: formData.mensagem || null,
        origem: "landing_page",
      });
      if (error) throw error;
      setSent(true);
      toast({ title: "Mensagem enviada!", description: "Entraremos em contato em breve." });
    } catch (err: any) {
      console.error("Contact form error:", err);
      // Fallback to mailto
      const subject = encodeURIComponent(`Contato - ${formData.nome}`);
      const body = encodeURIComponent(
        `Nome: ${formData.nome}\nEmail: ${formData.email}\nTelefone: ${formData.telefone}\n\n${formData.mensagem}`
      );
      window.open(`mailto:contato@essencialclinicas.com.br?subject=${subject}&body=${body}`);
      setSent(true);
      toast({ title: "Redirecionado para email", description: "Tente novamente ou envie por email." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contato" className="py-20">
      <div className="container mx-auto px-4 max-w-4xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <Card className="border-primary/20 overflow-hidden">
            <CardContent className="p-0">
              <div className="grid md:grid-cols-2">
                {/* Left: Info */}
                <div className="bg-primary text-primary-foreground p-8 md:p-10 flex flex-col justify-center space-y-6">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/20">
                    <Activity className="h-7 w-7" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold font-[Plus_Jakarta_Sans]">
                    Pronto para transformar sua clínica?
                  </h2>
                  <p className="text-primary-foreground/80">
                    Preencha o formulário ou entre em contato diretamente. Nossa equipe vai te ajudar a escolher o plano ideal.
                  </p>
                  <div className="flex flex-col gap-3 pt-4">
                    <Button variant="secondary" size="sm" className="gap-2 w-fit" asChild>
                      <a href="https://wa.me/5500000000000" target="_blank" rel="noopener noreferrer">
                        <Send className="h-4 w-4" /> WhatsApp
                      </a>
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2 w-fit" asChild>
                      <a href="mailto:contato@essencialclinicas.com.br">
                        <Mail className="h-4 w-4" /> contato@essencialclinicas.com.br
                      </a>
                    </Button>
                    <Button variant="secondary" size="sm" className="gap-2 w-fit" asChild>
                      <a href="https://instagram.com/essencialclinicas" target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" /> @essencialclinicas
                      </a>
                    </Button>
                  </div>
                </div>

                {/* Right: Form */}
                <div className="p-8 md:p-10">
                  {sent ? (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                      <CheckCircle2 className="h-16 w-16 text-primary" />
                      <h3 className="text-xl font-bold">Mensagem enviada!</h3>
                      <p className="text-muted-foreground">Entraremos em contato em breve.</p>
                      <Button variant="outline" onClick={() => { setSent(false); setFormData({ nome: "", email: "", telefone: "", mensagem: "" }); }}>
                        Enviar outra mensagem
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                      <h3 className="text-lg font-semibold mb-2">Solicite uma demonstração</h3>
                      <div className="space-y-2">
                        <Label htmlFor="nome">Nome *</Label>
                        <Input id="nome" placeholder="Seu nome completo" value={formData.nome}
                          onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email *</Label>
                        <Input id="email" type="email" placeholder="seu@email.com" value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="telefone">Telefone / WhatsApp</Label>
                        <Input id="telefone" placeholder="(00) 00000-0000" value={formData.telefone}
                          onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="mensagem">Mensagem</Label>
                        <Textarea id="mensagem" placeholder="Conte sobre sua clínica..." rows={3}
                          value={formData.mensagem}
                          onChange={(e) => setFormData({ ...formData, mensagem: e.target.value })} />
                      </div>
                      <Button type="submit" className="w-full gap-2" disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {loading ? "Enviando..." : "Enviar mensagem"}
                      </Button>
                    </form>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </section>
  );
};
