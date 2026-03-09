import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Video, VideoOff, Phone, MessageSquare, Users,
  Send, Clock, CheckCircle2, ArrowLeft, DoorOpen,
  Mic, MicOff, FileText, Download, Sparkles, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from "jspdf";
import ReactMarkdown from "react-markdown";

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
  transcricao_bruta?: string | null;
  resumo_clinico?: string | null;
  paciente_nome?: string;
  profissional_nome?: string;
  agendamento_id?: string;
  paciente_id?: string;
  clinic_id?: string | null;
}

// Web Speech API types
interface SpeechRecognitionEvent {
  results: SpeechRecognitionResultList;
  resultIndex: number;
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
  const [transcriptionOpen, setTranscriptionOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [callActive, setCallActive] = useState(false);

  // Transcription state
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcriptLines, setTranscriptLines] = useState<string[]>([]);
  const [interimText, setInterimText] = useState("");
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [clinicalSummary, setClinicalSummary] = useState("");

  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const isProfOrAdmin = isProfissional || isAdmin || isGestor;
  const userName = profile?.nome || user?.email || "Usuário";

  // ─── Load or create session ───
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
            const s = data as any;
            setSession(s);
            if (s.status === "em_andamento") setCallActive(true);
            if (s.transcricao_bruta) setTranscriptLines(s.transcricao_bruta.split("\n").filter(Boolean));
            if (s.resumo_clinico) setClinicalSummary(s.resumo_clinico);
          }
        } else if (agendamentoId) {
          const { data: existing } = await supabase
            .from("teleconsulta_sessions")
            .select("*")
            .eq("agendamento_id", agendamentoId)
            .in("status", ["aguardando", "em_andamento"])
            .maybeSingle();

          if (existing) {
            const s = existing as any;
            setSession(s);
            if (s.status === "em_andamento") setCallActive(true);
            if (s.transcricao_bruta) setTranscriptLines(s.transcricao_bruta.split("\n").filter(Boolean));
          } else {
            const { data: ag } = await supabase
              .from("agendamentos")
              .select("*, pacientes(nome), profiles:profissional_id(nome)")
              .eq("id", agendamentoId)
              .single() as any;

            if (!ag) { toast.error("Agendamento não encontrado"); return; }

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
            if ((existing as any).status === "em_andamento") setCallActive(true);
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

  // ─── Load Jitsi ───
  useEffect(() => {
    if (document.getElementById("jitsi-script")) { setJitsiLoaded(true); return; }
    const script = document.createElement("script");
    script.id = "jitsi-script";
    script.src = "https://meet.jit.si/external_api.js";
    script.async = true;
    script.onload = () => setJitsiLoaded(true);
    document.body.appendChild(script);
  }, []);

  // ─── Start Jitsi ───
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
        toolbarButtons: ["microphone", "camera", "desktop", "fullscreen", "hangup", "settings", "tileview"],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        TOOLBAR_ALWAYS_VISIBLE: true,
        MOBILE_APP_PROMO: false,
      },
      userInfo: { displayName: userName },
    });

    api.addEventListener("readyToClose", () => endCall());
    api.addEventListener("participantJoined", () => toast.success("Participante entrou na sala"));
    jitsiApiRef.current = api;

    supabase.from("teleconsulta_sessions")
      .update({ status: "em_andamento", started_at: new Date().toISOString() })
      .eq("id", session.id).then();

    return () => {
      if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    };
  }, [callActive, jitsiLoaded, session]);

  // ─── Realtime chat ───
  useEffect(() => {
    if (!session?.id) return;
    supabase.from("teleconsulta_messages").select("*").eq("session_id", session.id)
      .order("created_at", { ascending: true }).then(({ data }) => { if (data) setChatMessages(data as any); });

    const channel = supabase.channel(`teleconsulta-chat-${session.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "teleconsulta_messages", filter: `session_id=eq.${session.id}` },
        (payload) => setChatMessages((prev) => [...prev, payload.new as ChatMessage]))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id]);

  // ─── Realtime session status ───
  useEffect(() => {
    if (!session?.id) return;
    const channel = supabase.channel(`teleconsulta-session-${session.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "teleconsulta_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as any;
          setSession((prev) => (prev ? { ...prev, ...updated } : prev));
          if (updated.status === "em_andamento" && !callActive) {
            setCallActive(true);
            toast.success("Você foi admitido na sala!");
          }
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [session?.id, callActive]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);
  useEffect(() => { transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcriptLines, interimText]);

  // ─── Speech Recognition ───
  const startTranscription = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "pt-BR";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) {
            const timestamp = format(new Date(), "HH:mm:ss");
            const line = `[${timestamp}] ${userName}: ${text}`;
            setTranscriptLines((prev) => [...prev, line]);
          }
        } else {
          interim += result[0].transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") return;
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Permissão de microfone negada para transcrição.");
        setIsTranscribing(false);
      }
    };

    recognition.onend = () => {
      // Auto-restart if still transcribing
      if (recognitionRef.current && isTranscribing) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsTranscribing(true);
    setTranscriptionOpen(true);
    toast.success("Transcrição iniciada");
  };

  const stopTranscription = async () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsTranscribing(false);
    setInterimText("");

    // Save raw transcription
    if (session?.id && transcriptLines.length > 0) {
      const fullText = transcriptLines.join("\n");
      await supabase.from("teleconsulta_sessions")
        .update({ transcricao_bruta: fullText })
        .eq("id", session.id);
      toast.success("Transcrição salva");
    }
  };

  // ─── AI Summary ───
  const generateSummary = async () => {
    if (transcriptLines.length === 0) {
      toast.error("Nenhuma transcrição disponível para resumir.");
      return;
    }
    setGeneratingSummary(true);
    try {
      const fullText = transcriptLines.join("\n");
      const durationMin = session?.duration_seconds ? Math.round(session.duration_seconds / 60) : undefined;

      const { data, error } = await supabase.functions.invoke("summarize-teleconsulta", {
        body: {
          transcription: fullText,
          paciente_nome: session?.paciente_nome || "",
          profissional_nome: session?.profissional_nome || "",
          data_consulta: session?.started_at ? format(new Date(session.started_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "",
          duration_minutes: durationMin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const summary = data.summary || "";
      setClinicalSummary(summary);

      // Save to DB
      if (session?.id) {
        await supabase.from("teleconsulta_sessions")
          .update({ resumo_clinico: summary, resumo_gerado_em: new Date().toISOString() })
          .eq("id", session.id);
      }

      toast.success("Resumo clínico gerado com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao gerar resumo: " + e.message);
    } finally {
      setGeneratingSummary(false);
    }
  };

  // ─── PDF Export ───
  const exportPDF = () => {
    const doc = new jsPDF();
    const pageW = doc.internal.pageSize.getWidth();
    const margin = 15;
    const maxW = pageW - margin * 2;
    let y = 20;

    const addText = (text: string, fontSize: number, bold = false) => {
      doc.setFontSize(fontSize);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      const lines = doc.splitTextToSize(text, maxW);
      for (const line of lines) {
        if (y > 270) { doc.addPage(); y = 20; }
        doc.text(line, margin, y);
        y += fontSize * 0.5;
      }
      y += 3;
    };

    // Header
    doc.setFillColor(45, 100, 160);
    doc.rect(0, 0, pageW, 15, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text("Registro de Teleconsulta", margin, 10);
    doc.setTextColor(0, 0, 0);
    y = 25;

    // Info
    addText(`Paciente: ${session?.paciente_nome || "N/A"}`, 11, true);
    addText(`Profissional: ${session?.profissional_nome || "N/A"}`, 11, true);
    if (session?.started_at) {
      addText(`Data: ${format(new Date(session.started_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, 10);
    }
    if (session?.duration_seconds) {
      addText(`Duração: ${Math.floor(session.duration_seconds / 60)}min ${session.duration_seconds % 60}s`, 10);
    }
    y += 5;

    // Summary section
    if (clinicalSummary) {
      doc.setDrawColor(45, 100, 160);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
      addText("RESUMO CLÍNICO (Gerado por IA)", 12, true);
      y += 2;
      // Strip markdown for PDF
      const plainSummary = clinicalSummary
        .replace(/#{1,6}\s/g, "")
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/\*(.*?)\*/g, "$1")
        .replace(/- /g, "• ");
      addText(plainSummary, 10);
      y += 5;
    }

    // Transcription section
    if (transcriptLines.length > 0) {
      doc.setDrawColor(45, 100, 160);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
      addText("TRANSCRIÇÃO COMPLETA", 12, true);
      y += 2;
      for (const line of transcriptLines) {
        addText(line, 9);
      }
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(128, 128, 128);
      doc.text(`Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm")} | Página ${i} de ${totalPages}`, margin, 290);
    }

    const fileName = `teleconsulta_${session?.paciente_nome?.replace(/\s/g, "_") || "registro"}_${format(new Date(), "yyyyMMdd")}.pdf`;
    doc.save(fileName);
    toast.success("PDF exportado!");
  };

  // ─── Actions ───
  const sendMessage = async () => {
    if (!newMessage.trim() || !session?.id) return;
    await supabase.from("teleconsulta_messages").insert({
      session_id: session.id, sender_id: user?.id || "", sender_name: userName,
      sender_role: isProfOrAdmin ? "profissional" : "paciente", message: newMessage.trim(),
    });
    setNewMessage("");
  };

  const admitPatient = async () => {
    if (!session?.id) return;
    await supabase.from("teleconsulta_sessions")
      .update({ status: "em_andamento", admitted_at: new Date().toISOString(), started_at: new Date().toISOString() })
      .eq("id", session.id);
    setCallActive(true);
    toast.success("Paciente admitido!");
  };

  const enterWaitingRoom = async () => {
    if (!session?.id) return;
    await supabase.from("teleconsulta_sessions")
      .update({ waiting_room_entered_at: new Date().toISOString() })
      .eq("id", session.id);
    toast.info("Você está na sala de espera. Aguarde o profissional admitir.");
  };

  const endCall = async () => {
    // Stop transcription first
    if (isTranscribing) await stopTranscription();

    if (jitsiApiRef.current) { jitsiApiRef.current.dispose(); jitsiApiRef.current = null; }
    setCallActive(false);

    if (session?.id) {
      const now = new Date();
      const startedAt = session.started_at ? new Date(session.started_at) : now;
      const durationSec = Math.round((now.getTime() - startedAt.getTime()) / 1000);

      const updateData: any = {
        status: "finalizado",
        ended_at: now.toISOString(),
        duration_seconds: durationSec > 0 ? durationSec : 0,
      };
      if (transcriptLines.length > 0) {
        updateData.transcricao_bruta = transcriptLines.join("\n");
      }

      await supabase.from("teleconsulta_sessions").update(updateData).eq("id", session.id);
    }
    toast.success("Teleconsulta finalizada");
  };

  const goBack = () => {
    if (callActive) { endCall().then(() => navigate(-1)); } else { navigate(-1); }
  };

  // ─── Render ───
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
  const hasTranscription = transcriptLines.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b bg-card shrink-0 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={goBack}><ArrowLeft className="h-4 w-4" /></Button>
          <Video className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold hidden sm:block">Teleconsulta</h1>
          <Badge variant={callActive ? "default" : isWaiting ? "outline" : "secondary"}
            className={callActive ? "bg-green-600 text-white" : ""}>
            {callActive ? "Em andamento" : isWaiting ? "Sala de espera" : isFinished ? "Finalizada" : session.status}
          </Badge>
          {isTranscribing && (
            <Badge variant="outline" className="gap-1 text-destructive border-destructive/30 animate-pulse">
              <Mic className="h-3 w-3" /> REC
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Transcription toggle */}
          {(callActive || hasTranscription || isFinished) && (
            <Button variant={transcriptionOpen ? "default" : "outline"} size="sm"
              onClick={() => setTranscriptionOpen(!transcriptionOpen)} className="gap-1.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Transcrição</span>
            </Button>
          )}

          {/* Start/Stop transcription */}
          {callActive && (
            isTranscribing ? (
              <Button variant="destructive" size="sm" onClick={stopTranscription} className="gap-1.5">
                <MicOff className="h-4 w-4" />
                <span className="hidden sm:inline">Parar Transcrição</span>
              </Button>
            ) : (
              <Button variant="outline" size="sm" onClick={startTranscription} className="gap-1.5 border-primary/30 text-primary">
                <Mic className="h-4 w-4" />
                <span className="hidden sm:inline">Transcrever</span>
              </Button>
            )
          )}

          {/* Chat */}
          <Button variant={chatOpen ? "default" : "outline"} size="sm"
            onClick={() => setChatOpen(!chatOpen)} className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {chatMessages.length}
              </Badge>
            )}
          </Button>

          {/* End call */}
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
        <div className="flex-1 relative bg-black/95 min-w-0">
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
                    <Clock className="h-4 w-4 animate-pulse" /><span>Aguardando admissão...</span>
                  </div>
                )}
                {isProfOrAdmin ? (
                  <div className="space-y-3">
                    <Button size="lg" className="bg-green-600 hover:bg-green-700 text-white gap-2 w-full" onClick={admitPatient}>
                      <Video className="h-5 w-5" /> Iniciar Teleconsulta
                    </Button>
                    {session.waiting_room_entered_at && (
                      <div className="flex items-center justify-center gap-2 text-green-400 text-sm">
                        <CheckCircle2 className="h-4 w-4" /><span>Paciente está na sala de espera</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <Button size="lg" variant="outline" className="gap-2 w-full border-white/20 text-white hover:bg-white/10"
                    onClick={enterWaitingRoom} disabled={!!session.waiting_room_entered_at}>
                    <Users className="h-5 w-5" />
                    {session.waiting_room_entered_at ? "Na sala de espera" : "Entrar na sala de espera"}
                  </Button>
                )}
              </div>
            </div>
          ) : isFinished ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-4 p-8 max-w-lg">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold text-white">Teleconsulta Finalizada</h2>
                {session.duration_seconds != null && (
                  <p className="text-white/60">
                    Duração: {Math.floor(session.duration_seconds / 60)}min {session.duration_seconds % 60}s
                  </p>
                )}
                <div className="flex flex-wrap gap-2 justify-center">
                  {hasTranscription && !clinicalSummary && (
                    <Button onClick={generateSummary} disabled={generatingSummary}
                      className="gap-2 bg-primary hover:bg-primary/90">
                      {generatingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Gerar Resumo Clínico (IA)
                    </Button>
                  )}
                  {(hasTranscription || clinicalSummary) && (
                    <Button variant="outline" onClick={exportPDF}
                      className="gap-2 border-white/20 text-white hover:bg-white/10">
                      <Download className="h-4 w-4" /> Exportar PDF
                    </Button>
                  )}
                  <Button variant="outline" onClick={() => navigate(-1)}
                    className="border-white/20 text-white hover:bg-white/10">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Transcription panel */}
        {transcriptionOpen && (
          <div className="w-80 border-l flex flex-col bg-card shrink-0">
            <div className="p-3 border-b flex items-center justify-between">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Transcrição
              </h3>
              <div className="flex gap-1">
                {hasTranscription && (
                  <>
                    <Button variant="ghost" size="sm" onClick={generateSummary} disabled={generatingSummary}
                      className="h-7 text-xs gap-1">
                      {generatingSummary ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      Resumo IA
                    </Button>
                    <Button variant="ghost" size="sm" onClick={exportPDF} className="h-7 text-xs gap-1">
                      <Download className="h-3 w-3" /> PDF
                    </Button>
                  </>
                )}
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {/* Clinical summary */}
                {clinicalSummary && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 mb-3">
                    <p className="text-xs font-semibold text-primary mb-2 flex items-center gap-1">
                      <Sparkles className="h-3 w-3" /> Resumo Clínico (IA)
                    </p>
                    <div className="prose prose-sm max-w-none text-xs">
                      <ReactMarkdown>{clinicalSummary}</ReactMarkdown>
                    </div>
                  </div>
                )}

                {/* Raw transcription */}
                {transcriptLines.length === 0 && !isTranscribing && (
                  <p className="text-xs text-muted-foreground text-center py-8">
                    {callActive ? 'Clique em "Transcrever" para iniciar a transcrição automática.'
                      : "Nenhuma transcrição disponível."}
                  </p>
                )}
                {transcriptLines.map((line, i) => (
                  <p key={i} className="text-xs text-foreground/80 leading-relaxed">{line}</p>
                ))}
                {interimText && (
                  <p className="text-xs text-muted-foreground italic">{interimText}...</p>
                )}
                <div ref={transcriptEndRef} />
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Chat panel */}
        {chatOpen && !transcriptionOpen && (
          <div className="w-80 border-l flex flex-col bg-card shrink-0">
            <div className="p-3 border-b">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-primary" /> Chat da Teleconsulta
              </h3>
            </div>
            <ScrollArea className="flex-1 p-3">
              <div className="space-y-3">
                {chatMessages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Nenhuma mensagem ainda.</p>
                )}
                {chatMessages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${isMe ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                        {!isMe && <p className="text-[10px] font-medium opacity-70 mb-0.5">{msg.sender_name}</p>}
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
              <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); sendMessage(); }}>
                <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite uma mensagem..." className="text-sm" />
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
