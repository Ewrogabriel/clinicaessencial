import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video, VideoOff, Mic, MicOff, Phone, MessageSquare, Users,
  Send, Clock, CheckCircle2, ArrowLeft, DoorOpen,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChatMessage {
  id: string;
  sender_id: string;
  sender_name: string;
  sender_role: string;
  message: string;
  created_at: string;
}

interface SessionInfo {
  id: string;
  room_id: string;
  status: string;
  started_at?: string | null;
  waiting_room_entered_at?: string | null;
  duration_seconds?: number | null;
  paciente_nome?: string;
  profissional_nome?: string;
  agendamento_id?: string;
}

export default function Teleconsulta() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile, isProfissional, isAdmin, isGestor } = useAuth();

  const agendamentoId = params.get("agendamento");
  const roomParam = params.get("room");
  const sessionParam = params.get("session");

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [waitingPatients, setWaitingPatients] = useState<any[]>([]);
  const [callActive, setCallActive] = useState(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const isProfOrAdmin = isProfissional || isAdmin || isGestor;
  const userName = profile?.nome || user?.email || "Usuário";

  // Load or create session
  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        if (sessionParam) {
          const { data } = await supabase
            .from("teleconsulta_sessions")
            .select("*")
            .eq("id", sessionParam)
            .single();
          if (data) {
            setSession({ ...data, paciente_nome: "", profissional_nome: "" } as any);
            if (data.status === "em_andamento") setCallActive(true);
          }
        } else if (agendamentoId) {
          // Check existing session
          const { data: existing } = await supabase
            .from("teleconsulta_sessions")
            .select("*")
            .eq("agendamento_id", agendamentoId)
            .in("status", ["aguardando", "em_andamento"])
            .maybeSingle();

          if (existing) {
            setSession(existing as any);
            if (existing.status === "em_andamento") setCallActive(true);
          } else {
            // Fetch agendamento details
            const { data: ag } = await supabase
              .from("agendamentos")
              .select("*, pacientes(nome), profiles:profissional_id(nome)")
              .eq("id", agendamentoId)
              .single() as any;

            if (!ag) {
              toast.error("Agendamento não encontrado");
              return;
            }

            const roomId = `essencial-fisio-${agendamentoId.slice(0, 8)}`;

            const { data: newSession, error } = await supabase
              .from("teleconsulta_sessions")
              .insert({
                agendamento_id: agendamentoId,
                clinic_id: ag.clinic_id,
                profissional_id: ag.profissional_id,
                paciente_id: ag.paciente_id,
                room_id: roomId,
                status: "aguardando",
              })
              .select()
              .single();

            if (error) throw error;
            setSession({
              ...(newSession as any),
              paciente_nome: ag.pacientes?.nome,
              profissional_nome: ag.profiles?.nome,
            });
          }
        } else if (roomParam) {
          const { data: existing } = await supabase
            .from("teleconsulta_sessions")
            .select("*")
            .eq("room_id", roomParam)
            .in("status", ["aguardando", "em_andamento"])
            .maybeSingle();
          if (existing) {
            setSession(existing as any);
            if (existing.status === "em_andamento") setCallActive(true);
          }
        }
      } catch (e: any) {
        toast.error("Erro ao carregar sessão: " + e.message);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [agendamentoId, sessionParam, roomParam]);

  // Load Jitsi API script
  useEffect(() => {
    if (document.getElementById("jitsi-script")) {
      setJitsiLoaded(true);
      return;
    }
    const script = document.createElement("script");
    script.id = "jitsi-script";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => setJitsiLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Start Jitsi when call is active
  useEffect(() => {
    if (!callActive || !jitsiLoaded || !session || !jitsiContainerRef.current) return;
    if (jitsiApiRef.current) return;

    const api = new (window as any).JitsiMeetExternalAPI("meet.jit.si", {
      roomName: session.room_id,
      parentNode: jitsiContainerRef.current,
      width: "100%",
      height: "100%",
      configOverwrite: {
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        toolbarButtons: [
          "microphone", "camera", "desktop", "fullscreen",
          "hangup", "settings", "tileview",
        ],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_ALWAYS_VISIBLE: true,
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
        MOBILE_APP_PROMO: false,
      },
      userInfo: {
        displayName: userName,
      },
    });

    api.addEventListener("readyToClose", () => {
      endCall();
    });

    api.addEventListener("participantJoined", () => {
      toast.success("Participante entrou na sala");
    });

    jitsiApiRef.current = api;

    // Log start
    supabase
      .from("teleconsulta_sessions")
      .update({ status: "em_andamento", started_at: new Date().toISOString() })
      .eq("id", session.id)
      .then();

    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
        jitsiApiRef.current = null;
      }
    };
  }, [callActive, jitsiLoaded, session]);

  // Realtime chat messages
  useEffect(() => {
    if (!session?.id) return;

    // Load existing messages
    supabase
      .from("teleconsulta_messages")
      .select("*")
      .eq("session_id", session.id)
      .order("created_at", { ascending: true })
      .then(({ data }) => {
        if (data) setChatMessages(data as any);
      });

    const channel = supabase
      .channel(`teleconsulta-chat-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "teleconsulta_messages",
          filter: `session_id=eq.${session.id}`,
        },
        (payload) => {
          setChatMessages((prev) => [...prev, payload.new as ChatMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id]);

  // Realtime session status (for waiting room)
  useEffect(() => {
    if (!session?.id) return;

    const channel = supabase
      .channel(`teleconsulta-session-${session.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "teleconsulta_sessions",
          filter: `id=eq.${session.id}`,
        },
        (payload) => {
          const updated = payload.new as any;
          setSession((prev) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status === "em_andamento" && !callActive) {
            setCallActive(true);
            toast.success("Você foi admitido na sala!");
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.id, callActive]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !session?.id) return;
    await supabase.from("teleconsulta_messages").insert({
      session_id: session.id,
      sender_id: user?.id || "",
      sender_name: userName,
      sender_role: isProfOrAdmin ? "profissional" : "paciente",
      message: newMessage.trim(),
    });
    setNewMessage("");
  };

  const admitPatient = async () => {
    if (!session?.id) return;
    await supabase
      .from("teleconsulta_sessions")
      .update({
        status: "em_andamento",
        admitted_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
      })
      .eq("id", session.id);
    setCallActive(true);
    toast.success("Paciente admitido!");
  };

  const enterWaitingRoom = async () => {
    if (!session?.id) return;
    await supabase
      .from("teleconsulta_sessions")
      .update({ waiting_room_entered_at: new Date().toISOString() })
      .eq("id", session.id);
    toast.info("Você está na sala de espera. Aguarde o profissional admitir.");
  };

  const endCall = async () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    setCallActive(false);

    if (session?.id) {
      const now = new Date();
      const startedAt = session.started_at
        ? new Date(session.started_at as any)
        : now;
      const durationSec = Math.round((now.getTime() - startedAt.getTime()) / 1000);

      await supabase
        .from("teleconsulta_sessions")
        .update({
          status: "finalizado",
          ended_at: now.toISOString(),
          duration_seconds: durationSec > 0 ? durationSec : 0,
        })
        .eq("id", session.id);
    }

    toast.success("Teleconsulta finalizada");
  };

  const goBack = () => {
    if (callActive) {
      endCall().then(() => navigate(-1));
    } else {
      navigate(-1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-3">
          <Video className="h-10 w-10 text-primary mx-auto animate-pulse" />
          <p className="text-muted-foreground">Carregando teleconsulta...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex items-center justify-center h-[70vh]">
        <div className="text-center space-y-3">
          <VideoOff className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">Sessão não encontrada</p>
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
          </Button>
        </div>
      </div>
    );
  }

  const isWaiting = session.status === "aguardando";
  const isFinished = session.status === "finalizado";

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Video className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Teleconsulta</h1>
          </div>
          <Badge
            variant={callActive ? "default" : isWaiting ? "outline" : "secondary"}
            className={callActive ? "bg-green-600 text-white" : ""}
          >
            {callActive ? "Em andamento" : isWaiting ? "Sala de espera" : isFinished ? "Finalizada" : session.status}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={chatOpen ? "default" : "outline"}
            size="sm"
            onClick={() => setChatOpen(!chatOpen)}
            className="gap-1.5"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {chatMessages.length}
              </Badge>
            )}
          </Button>
          {callActive && (
            <Button variant="destructive" size="sm" onClick={endCall} className="gap-1.5">
              <Phone className="h-4 w-4" />
              <span className="hidden sm:inline">Encerrar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Video area */}
        <div className="flex-1 relative bg-black/95">
          {callActive ? (
            <div ref={jitsiContainerRef} className="w-full h-full" />
          ) : isWaiting ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-6 p-8 max-w-md">
                <div className="mx-auto w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
                  <DoorOpen className="h-12 w-12 text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white mb-2">Sala de Espera</h2>
                  <p className="text-white/60 text-sm">
                    {isProfOrAdmin
                      ? "Você é o profissional. Inicie a chamada quando estiver pronto."
                      : "Aguarde o profissional admitir você na sala."}
                  </p>
                </div>

                {session.waiting_room_entered_at && !isProfOrAdmin && (
                  <div className="flex items-center justify-center gap-2 text-white/50 text-sm">
                    <Clock className="h-4 w-4 animate-pulse" />
                    <span>Aguardando admissão...</span>
                  </div>
                )}

                {isProfOrAdmin ? (
                  <div className="space-y-3">
                    <Button
                      size="lg"
                      className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full"
                      onClick={() => {
                        admitPatient();
                      }}
                    >
                      <Video className="h-5 w-5" />
                      Iniciar Teleconsulta
                    </Button>
                    {session.waiting_room_entered_at && (
                      <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Paciente está na sala de espera</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    size="lg"
                    variant="outline"
                    className="gap-2 w-full border-white/20 text-white hover:bg-white/10"
                    onClick={enterWaitingRoom}
                    disabled={!!session.waiting_room_entered_at}
                  >
                    <Users className="h-5 w-5" />
                    {session.waiting_room_entered_at ? "Na sala de espera" : "Entrar na sala de espera"}
                  </Button>
                )}
              </div>
            </div>
          ) : isFinished ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 p-8">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-white">Teleconsulta Finalizada</h2>
                {session.duration_seconds && (
                  <p className="text-white/60">
                    Duração: {Math.floor((session as any).duration_seconds / 60)}min {(session as any).duration_seconds % 60}s
                  </p>
                )}
                <Button variant="outline" onClick={() => navigate(-1)} className="border-white/20 text-white hover:bg-white/10">
                  <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                </Button>
              </div>
            </div>
          ) : null}
        </div>

        {/* Chat panel */}
        {chatOpen && (
          <div className="w-80 border-l flex flex-col bg-card shrink-0">
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" />
                Chat da Teleconsulta
              </h3>
            </div>

            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    Nenhuma mensagem ainda. Envie a primeira!
                  </p>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                          isMe
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        {!isMe && (
                          <p className="text-[10px] font-medium opacity-70 mb-0.5">
                            {msg.sender_name}
                          </p>
                        )}
                        <p className="whitespace-pre-wrap break-words">{msg.message}</p>
                        <p className={`text-[10px] mt-1 ${isMe ? "opacity-70" : "text-muted-foreground"}`}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>

            <div className="p-3 border-t">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  sendMessage();
                }}
              >
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem..."
                  className="text-sm"
                />
                <Button type="submit" size="icon" disabled={!newMessage.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
