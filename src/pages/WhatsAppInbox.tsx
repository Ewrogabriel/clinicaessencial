import { useState, useEffect, useRef } from "react";
import {
  MessageCircle, Search, CheckCheck, Clock, User, Send,
  Loader2, ChevronRight, PhoneCall, X, MoreVertical
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import {
  getConversations,
  getMessages,
  assignProfessional,
  setConversationStatus,
  markAsRead,
  sendReply,
} from "@/modules/whatsapp/services/whatsappConversationService";
import type { WhatsAppConversation, WhatsAppConversationMessage } from "@/modules/whatsapp/types";
import { toast } from "sonner";

// ── Professional list hook ────────────────────────────────────

function useProfessionals(clinicId: string) {
  return useQuery({
    queryKey: ["professionals-basic", clinicId],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("user_id, nome")
        .eq("clinic_id", clinicId)
        .order("nome");
      return (data ?? []) as { user_id: string; nome: string }[];
    },
    enabled: Boolean(clinicId),
  });
}

// ── Conversation card ─────────────────────────────────────────

function ConvCard({
  conv,
  active,
  onClick,
}: {
  conv: WhatsAppConversation;
  active: boolean;
  onClick: () => void;
}) {
  const initials = (conv.contact_name ?? conv.phone_number)
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 transition-colors border-b border-border/50",
        active && "bg-primary/5 border-l-2 border-l-primary"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="text-xs font-semibold bg-green-100 text-green-700">
          {initials}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium truncate">{conv.contact_name ?? conv.phone_number}</span>
          {conv.last_message_at && (
            <span className="text-xs text-muted-foreground ml-2 shrink-0">
              {new Date(conv.last_message_at).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          )}
        </div>
        <div className="flex justify-between items-center mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {conv.last_message_preview ?? "—"}
          </p>
          {conv.unread_count > 0 && (
            <Badge className="ml-2 h-5 min-w-5 rounded-full bg-green-500 text-white text-xs px-1.5 shrink-0">
              {conv.unread_count}
            </Badge>
          )}
        </div>
        {conv.professional && (
          <p className="text-xs text-primary/70 mt-0.5">
            👤 {(conv.professional as any).nome}
          </p>
        )}
      </div>
    </button>
  );
}

// ── Message bubble ────────────────────────────────────────────

function MessageBubble({ msg }: { msg: WhatsAppConversationMessage }) {
  const isOut = msg.direction === "outgoing";
  return (
    <div className={cn("flex", isOut ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[75%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isOut
            ? "bg-green-500 text-white rounded-br-sm"
            : "bg-white dark:bg-zinc-800 border border-border rounded-bl-sm"
        )}
      >
        {msg.content}
        <div
          className={cn(
            "flex items-center justify-end gap-1 mt-1 text-[10px]",
            isOut ? "text-green-100" : "text-muted-foreground"
          )}
        >
          {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
          {isOut && <CheckCheck className="h-3 w-3" />}
        </div>
        {isOut && msg.professional && (
          <p className="text-[10px] text-green-100 mt-0.5">
            {(msg.professional as any).nome}
          </p>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────

export default function WhatsAppInbox() {
  const { activeClinicId } = useClinic();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const clinicId = activeClinicId ?? "";

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [replyText, setReplyText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: professionals = [] } = useProfessionals(clinicId);

  // Conversations
  const { data: conversations = [], isLoading: loadingConvs } = useQuery({
    queryKey: ["wa-conversations", clinicId],
    queryFn: () => getConversations(clinicId),
    enabled: Boolean(clinicId),
    refetchInterval: 15_000,
  });

  const selectedConv = conversations.find((c) => c.id === selectedId) ?? null;

  // Messages
  const { data: messages = [], isLoading: loadingMsgs } = useQuery({
    queryKey: ["wa-messages", selectedId],
    queryFn: () => getMessages(selectedId!),
    enabled: Boolean(selectedId),
    refetchInterval: 5_000,
  });

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark as read when selecting
  useEffect(() => {
    if (selectedId) {
      markAsRead(selectedId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] });
      });
    }
  }, [selectedId, clinicId, queryClient]);

  // Realtime subscription
  useEffect(() => {
    if (!clinicId) return;
    const channel = supabase
      .channel(`wa-inbox-${clinicId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "whatsapp_conversations", filter: `clinic_id=eq.${clinicId}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] });
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_conversation_messages" }, (payload) => {
        const msg = payload.new as WhatsAppConversationMessage;
        if (msg.conversation_id === selectedId) {
          queryClient.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
        }
        queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [clinicId, selectedId, queryClient]);

  // Assign professional
  const assignMutation = useMutation({
    mutationFn: ({ convId, profId }: { convId: string; profId: string | null }) =>
      assignProfessional(convId, profId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] }),
    onError: () => toast.error("Erro ao atribuir profissional"),
  });

  // Close conversation
  const closeMutation = useMutation({
    mutationFn: (convId: string) => setConversationStatus(convId, "closed"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] });
      setSelectedId(null);
    },
    onError: () => toast.error("Erro ao encerrar conversa"),
  });

  // Send reply
  const sendMutation = useMutation({
    mutationFn: () =>
      sendReply({
        conversationId: selectedId!,
        clinicId,
        phoneNumber: selectedConv!.phone_number,
        content: replyText.trim(),
        professionalId: user?.id ?? "",
      }),
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["wa-messages", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["wa-conversations", clinicId] });
    },
    onError: (e: Error) => toast.error("Erro ao enviar mensagem", { description: e.message }),
  });

  const filteredConvs = conversations.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.contact_name?.toLowerCase().includes(q) ||
      c.phone_number.includes(q)
    );
  });

  const totalUnread = conversations.reduce((s, c) => s + (c.unread_count ?? 0), 0);

  return (
    <div className="flex h-[calc(100vh-120px)] border rounded-xl overflow-hidden bg-background shadow-sm">
      {/* ── Sidebar ──────────────────────────────────────────── */}
      <div className="w-[320px] shrink-0 flex flex-col border-r">
        <div className="p-4 border-b space-y-3">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-base">WhatsApp Inbox</h2>
            {totalUnread > 0 && (
              <Badge className="bg-green-500 text-white rounded-full h-5 px-1.5 text-xs">
                {totalUnread}
              </Badge>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversa..."
              className="pl-8 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvs ? (
            <div className="flex justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : filteredConvs.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
              <MessageCircle className="h-8 w-8 opacity-30" />
              <p className="text-sm">Nenhuma conversa</p>
            </div>
          ) : (
            filteredConvs.map((c) => (
              <ConvCard
                key={c.id}
                conv={c}
                active={selectedId === c.id}
                onClick={() => setSelectedId(c.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Messages panel ───────────────────────────────────── */}
      {selectedConv ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
            <div className="flex items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="text-xs font-semibold bg-green-100 text-green-700">
                  {(selectedConv.contact_name ?? selectedConv.phone_number)
                    .split(" ")
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")
                    .toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-sm">
                  {selectedConv.contact_name ?? selectedConv.phone_number}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <PhoneCall className="h-3 w-3" /> {selectedConv.phone_number}
                  {selectedConv.patient && (
                    <span className="ml-2 text-primary">
                      · Paciente: {(selectedConv.patient as any).nome}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Assign professional */}
              <div className="flex items-center gap-1">
                <User className="h-4 w-4 text-muted-foreground" />
                <Select
                  value={selectedConv.assigned_professional_id ?? "none"}
                  onValueChange={(v) =>
                    assignMutation.mutate({ convId: selectedConv.id, profId: v === "none" ? null : v })
                  }
                >
                  <SelectTrigger className="h-8 w-40 text-xs">
                    <SelectValue placeholder="Atribuir profissional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguém</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.user_id} value={p.user_id}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant="outline" size="sm" className="h-8 gap-1 text-xs"
                onClick={() => closeMutation.mutate(selectedConv.id)}
                disabled={closeMutation.isPending}
              >
                <X className="h-3 w-3" /> Encerrar
              </Button>
            </div>
          </div>

          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-[url('/chat-bg.svg')] bg-muted/20">
            {loadingMsgs ? (
              <div className="flex justify-center py-8 text-muted-foreground gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Carregando mensagens...
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground gap-2">
                <MessageCircle className="h-8 w-8 opacity-30" />
                <p className="text-sm">Nenhuma mensagem ainda</p>
              </div>
            ) : (
              messages.map((m) => <MessageBubble key={m.id} msg={m} />)
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Reply bar */}
          <div className="p-3 border-t flex gap-2 items-end bg-background">
            <Textarea
              placeholder="Digite sua mensagem..."
              className="min-h-[42px] max-h-[120px] resize-none text-sm"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (replyText.trim()) sendMutation.mutate();
                }
              }}
            />
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!replyText.trim() || sendMutation.isPending}
              className="h-10 gap-2 shrink-0 bg-green-600 hover:bg-green-700"
            >
              {sendMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
          <MessageCircle className="h-16 w-16 opacity-20" />
          <p className="text-sm">Selecione uma conversa para começar</p>
          <p className="text-xs opacity-60">As mensagens recebidas aparecerão aqui em tempo real</p>
        </div>
      )}
    </div>
  );
}
