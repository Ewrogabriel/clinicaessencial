import { useState, useEffect, useRef } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video, Send, MessageSquare, Clock, Loader2, Users,
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

export default function TeleconsultaPublica() {
  const { roomId } = useParams<{ roomId: string }>();
  const [params] = useSearchParams();
  const sessionIdParam = params.get("session");

  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [patientName, setPatientName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [callEnded, setCallEnded] = useState(false);

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Find session by room_id or session id
  useEffect(() => {
    async function findSession() {
      setLoading(true);
      try {
        let query = supabase.from("teleconsulta_sessions").select("*");
        
        if (sessionIdParam) {
          query = query.eq("id", sessionIdParam);
        } else if (roomId) {
          query = query.eq("room_id", roomId);
        } else {
          setError("Link inválido.");
          return;
        }

        const { data, error: err } = await query
          .in("status", ["aguardando", "em_andamento"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (err || !data) {
          setError("Sessão não encontrada ou já encerrada. Solicite um novo link ao profissional.");
          return;
        }
        setSession(data);
        if (data.status === "em_andamento") {
          setCallActive(true);
        }
      } catch {
        setError("Erro ao buscar sessão.");
      } finally {
        setLoading(false);
      }
    }
    findSession();
  }, [roomId, sessionIdParam]);

  // Load Jitsi script
  useEffect(() => {
    if (document.getElementById("jitsi-script")) { setJitsiLoaded(true); return; }
    const script = document.createElement("script");
    script.id = "jitsi-script";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => setJitsiLoaded(true);
    document.body.appendChild(script);
  }, []);

  // Start Jitsi when call is active and name confirmed
  useEffect(() => {
    if (!callActive || !jitsiLoaded || !session || !jitsiContainerRef.current || !nameConfirmed) return;
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
        toolbarButtons: ["microphone", "camera", "fullscreen", "hangup", "settings", "tileview"],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_ALWAYS_VISIBLE: true,
        MOBILE_APP_PROMO: false,
      },
      userInfo: { displayName: patientName || "Paciente" },
    });

    api.addEventListener("readyToClose", () => {
      setCallActive(false);
      setCallEnded(true);
      if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    });

    jitsiApiRef.current = api;

    // Update waiting_room_entered_at
    supabase.from("teleconsulta_sessions")
      .update({ waiting_room_entered_at: new Date().toISOString() })
      .eq("id", session.id).then();

    return () => {
      if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    };
  }, [callActive, jitsiLoaded, session, nameConfirmed]);

  // Realtime session status
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase.channel(`pub-session-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teleconsulta_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as any;
          setSession((prev: any) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status === "em_andamento" && !callActive && nameConfirmed) {
            setCallActive(true);
            toast.success("A consulta começou!");
          }
          if (updated.status === "encerrada") {
            setCallEnded(true);
            setCallActive(false);
            if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, callActive, nameConfirmed]);

  // Realtime chat
  useEffect(() => {
    if (!session?.id) return;
    supabase.from("teleconsulta_messages").select("*").eq("session_id", session.id)
      .order("created_at", { ascending: true }).then(({ data }) => { if (data) setChatMessages(data as any); });

    const channel = supabase.channel(`pub-chat-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teleconsulta_messages", filter: `session_id=eq.${session.id}` },
        (payload) => setChatMessages((prev) => [...prev, payload.new as ChatMessage]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !session?.id) return;
    await supabase.from("teleconsulta_messages").insert({
      session_id: session.id,
      sender_id: "paciente-anonimo",
      sender_name: patientName || "Paciente",
      sender_role: "paciente",
      message: newMessage.trim(),
    } as any);
    setNewMessage("");
  };

  const joinCall = () => {
    if (!patientName.trim()) {
      toast.error("Por favor, insira seu nome antes de entrar.");
      return;
    }
    setNameConfirmed(true);
    if (session?.status === "em_andamento") {
      setCallActive(true);
    }
  };

  // ─── Loading ───
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Carregando teleconsulta...</p>
        </div>
      </div>
    );
  }

  // ─── Error ───
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <Video className="h-12 w-12 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-semibold">Teleconsulta</h2>
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Call ended ───
  if (callEnded) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <Video className="h-8 w-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold">Consulta Encerrada</h2>
            <p className="text-muted-foreground">
              Obrigado pela sua participação! A teleconsulta foi encerrada.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Waiting / Name input ───
  if (!nameConfirmed) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 space-y-6">
            <div className="text-center space-y-2">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Video className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-semibold">Teleconsulta</h2>
              <p className="text-muted-foreground text-sm">
                {session?.status === "aguardando"
                  ? "O profissional ainda não iniciou a sessão. Você será conectado automaticamente."
                  : "A consulta já está em andamento. Insira seu nome para entrar."}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Seu nome</label>
              <Input
                placeholder="Digite seu nome completo"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinCall()}
              />
            </div>

            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
              <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
              <p className="text-xs text-muted-foreground">
                {session?.status === "aguardando"
                  ? "Aguardando o profissional iniciar a sessão..."
                  : "Sessão em andamento"}
              </p>
            </div>

            <Button className="w-full gap-2" size="lg" onClick={joinCall}>
              <Video className="h-5 w-5" />
              {session?.status === "em_andamento" ? "Entrar na Consulta" : "Entrar na Sala de Espera"}
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              Certifique-se de que sua câmera e microfone estão habilitados.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Waiting for professional to start ───
  if (session?.status === "aguardando" && !callActive) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-4">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center space-y-6">
            <div className="h-16 w-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-semibold">Sala de Espera</h2>
            <p className="text-muted-foreground">
              Olá, <strong>{patientName}</strong>! Aguarde o profissional iniciar a consulta.
            </p>
            <div className="flex items-center justify-center gap-2">
              <div className="h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-sm text-muted-foreground">Aguardando...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Active call ───
  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card">
        <div className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Teleconsulta</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setChatOpen(!chatOpen)} className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Chat
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 relative bg-black" ref={jitsiContainerRef} />

        {/* Chat sidebar */}
        {chatOpen && (
          <div className="w-80 border-l flex flex-col bg-card">
            <div className="p-3 border-b">
              <h3 className="font-medium text-sm">Chat</h3>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={`text-sm ${msg.sender_role === "paciente" ? "text-right" : ""}`}>
                    <span className="font-medium text-xs text-muted-foreground">{msg.sender_name}</span>
                    <p className={`mt-0.5 p-2 rounded-lg inline-block max-w-[90%] ${
                      msg.sender_role === "paciente" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {msg.message}
                    </p>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </ScrollArea>
            <div className="p-3 border-t flex gap-2">
              <Input
                placeholder="Mensagem..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                className="text-sm"
              />
              <Button size="icon" onClick={sendMessage}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
