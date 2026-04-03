import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { useClinic } from "@/modules/clinic/hooks/useClinic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Video, VideoOff, Phone, MessageSquare, Users,
  Send, Clock, CheckCircle2, ArrowLeft, DoorOpen,
  Mic, MicOff, FileText, Download, Sparkles, Loader2,
  Copy, Share2, Link as LinkIcon,
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
  profissional_id?: string;
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
  const { activeClinicId } = useClinic();

  const agendamentoId = params.get("agendamento");
  const roomParam = params.get("room");
  const sessionParam = params.get("session");

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorState, setErrorState] = useState<{ message: string; canCreateAvulsa?: boolean } | null>(null);
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

  // Post-consultation notes
  const [showNotesDialog, setShowNotesDialog] = useState(false);
  const [postConsultNotes, setPostConsultNotes] = useState("");
  const [isSavingEvolution, setIsSavingEvolution] = useState(false);

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
          // Validate that agendamentoId looks like a UUID before querying
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(agendamentoId)) {
            console.warn("[Teleconsulta] agendamentoId inválido:", agendamentoId);
            const msg = "Parâmetro de agendamento inválido. Verifique o link e tente novamente.";
            toast.error(msg);
            setErrorState({ message: msg, canCreateAvulsa: isProfOrAdmin });
            return;
          }

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
            console.log("[Teleconsulta] Buscando agendamento ID:", agendamentoId);
            const { data: ag, error: agError } = await supabase
              .from("agendamentos")
              .select("*, pacientes(nome)")
              .eq("id", agendamentoId)
              .single() as any;

            if (agError || !ag) {
              console.error("[Teleconsulta] Agendamento error:", agError, "ID:", agendamentoId);
              const msg = "Agendamento não encontrado. Verifique se o link está correto ou se o agendamento ainda existe.";
              toast.error(msg);
              setErrorState({ message: msg, canCreateAvulsa: isProfOrAdmin });
              return;
            }

            // Fetch professional name separately
            let profNome = "Profissional";
            const { data: profProfile } = await supabase
              .from("profiles")
              .select("nome")
              .eq("user_id", ag.profissional_id)
              .single();
            if (profProfile) profNome = profProfile.nome;

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
              profissional_nome: profNome,
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
        } else if (params.get("nova") === "1" && isProfOrAdmin) {
          const roomId = `essencial-fisio-${Math.random().toString(36).substring(2, 10)}`;
          const { data: newSession, error } = await supabase
            .from("teleconsulta_sessions")
            .insert({
              clinic_id: activeClinicId,
              profissional_id: user?.id,
              room_id: roomId,
              status: "aguardando",
            } as any)
            .select()
            .single();

          if (error) throw error;
          setSession({
            ...(newSession as any),
            profissional_nome: userName,
          });
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

  // ─── Start Jitsi + Auto start transcription ───
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

    // Auto-start transcription when call starts
    if (isProfOrAdmin && !isTranscribing) {
      setTimeout(() => startTranscription(), 2000);
    }

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
  const micPermissionDeniedRef = useRef(false);

  const startTranscription = async () => {
    if (micPermissionDeniedRef.current) {
      toast.error("Permissão de microfone negada. Habilite nas configurações do navegador e recarregue a página.");
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast.error("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
      return;
    }

    // Check microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
    } catch {
      micPermissionDeniedRef.current = true;
      toast.error("Permissão de microfone negada. Habilite nas configurações do navegador.");
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
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        micPermissionDeniedRef.current = true;
        recognitionRef.current = null;
        setIsTranscribing(false);
        toast.error("Permissão de microfone negada para transcrição.");
        return;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current && !micPermissionDeniedRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsTranscribing(true);
    setTranscriptionOpen(true);
    toast.success("Transcrição iniciada automaticamente");
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

    // Post-consult notes
    if (postConsultNotes) {
      doc.setDrawColor(45, 100, 160);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageW - margin, y);
      y += 8;
      addText("OBSERVAÇÕES DO PROFISSIONAL", 12, true);
      y += 2;
      addText(postConsultNotes, 10);
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

      // Auto-generate summary if not already generated
      if (!clinicalSummary && transcriptLines.length > 0 && isProfOrAdmin) {
        await generateSummary();
      }

      // Open notes dialog for professionals
      if (isProfOrAdmin) {
        setShowNotesDialog(true);
      } else {
        toast.success("Teleconsulta finalizada");
        navigate("/teleconsulta-hub");
      }
    } else {
      toast.success("Teleconsulta finalizada");
      navigate("/teleconsulta-hub");
    }
  };

  const handleSaveEvolution = async () => {
    if (!session || !activeClinicId) return;
    setIsSavingEvolution(true);

    try {
      // Criar evolução no prontuário
      const evolutionContent = `**Teleconsulta realizada em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}**

${clinicalSummary || ""}

**Transcrição:**
${transcriptLines.join("\n") || "Transcrição não disponível"}

${postConsultNotes ? `**Observações pós-consulta:**\n${postConsultNotes}` : ""}`;

      const { data: evolution, error: evolutionError } = await supabase
        .from("evolutions")
        .insert({
          paciente_id: session.paciente_id!,
          profissional_id: session.profissional_id!,
          clinic_id: activeClinicId,
          data_evolucao: new Date().toISOString(),
          descricao: evolutionContent,
          conduta: clinicalSummary || undefined,
        })
        .select()
        .single();

      if (evolutionError) throw evolutionError;

      // Atualizar sessão com referência à evolução e notas
      await supabase
        .from("teleconsulta_sessions")
        .update({
          evolution_id: evolution.id,
          notas_pos_consulta: postConsultNotes || null,
          resumo_clinico: clinicalSummary || null,
        })
        .eq("id", session.id);

      toast.success("Registro salvo no prontuário do paciente");
      navigate("/teleconsulta-hub");
    } catch (error) {
      console.error("Erro ao salvar evolução:", error);
      toast.error("Erro ao salvar no prontuário");
    } finally {
      setIsSavingEvolution(false);
    }
  };

  const goBack = () => {
    if (callActive) { endCall().then(() => navigate(-1)); } else { navigate(-1); }
  };

  const createAvulsaSession = async () => {
    if (!activeClinicId || !user?.id) {
      toast.error("Clínica ou usuário não identificado. Tente novamente.");
      return;
    }
    setLoading(true);
    try {
      const roomId = `essencial-fisio-${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`;
      console.log("[Teleconsulta] Criando sessão avulsa, room_id:", roomId);
      const { data: newSession, error } = await supabase
        .from("teleconsulta_sessions")
        .insert({
          clinic_id: activeClinicId,
          profissional_id: user.id,
          room_id: roomId,
          status: "aguardando",
        } as any)
        .select()
        .single();
      if (error) throw error;
      setErrorState(null);
      setSession({
        ...(newSession as any),
        profissional_nome: userName,
      });
    } catch (e: any) {
      console.error("[Teleconsulta] Erro ao criar sessão avulsa:", e);
      toast.error("Erro ao criar sessão avulsa: " + e.message);
    } finally {
      setLoading(false);
    }
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
        <div className="text-center space-y-4 max-w-md px-4">
          <VideoOff className="h-10 w-10 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">
            {errorState?.message || "Sessão não encontrada"}
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {errorState?.canCreateAvulsa && (
              <Button onClick={createAvulsaSession} className="gap-2">
                <Video className="h-4 w-4" /> Criar Sessão Avulsa
              </Button>
            )}
            <Button variant="outline" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
            </Button>
          </div>
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

          {/* Chat toggle */}
          <Button variant={chatOpen ? "default" : "outline"} size="sm"
            onClick={() => setChatOpen(!chatOpen)} className="gap-1.5">
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Chat</span>
            {chatMessages.length > 0 && <Badge variant="secondary" className="ml-1 h-5">{chatMessages.length}</Badge>}
          </Button>

          {/* Export PDF */}
          {(hasTranscription || clinicalSummary) && (
            <Button variant="outline" size="sm" onClick={exportPDF} className="gap-1.5">
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Exportar PDF</span>
            </Button>
          )}

          {/* End call */}
          {callActive && (
            <Button variant="destructive" size="sm" onClick={endCall} className="gap-1.5">
              <Phone className="h-4 w-4 rotate-135" />
              <span className="hidden sm:inline">Encerrar</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Video area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Waiting room */}
          {isWaiting && !callActive && (
            <div className="flex-1 flex items-center justify-center bg-muted/30">
              <div className="text-center space-y-4 p-6 max-w-md">
                <div className="h-20 w-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                  <Clock className="h-10 w-10 text-primary animate-pulse" />
                </div>
                <h2 className="text-xl font-semibold">Sala de Espera</h2>
                {isProfOrAdmin ? (
                  <>
                    <p className="text-muted-foreground">
                      Paciente: <strong>{session.paciente_nome || "Aguardando..."}</strong>
                    </p>
                    <Button onClick={admitPatient} size="lg" className="gap-2">
                      <DoorOpen className="h-5 w-5" /> Iniciar Teleconsulta
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-muted-foreground">
                      Aguarde o profissional <strong>{session.profissional_nome}</strong> admitir você na sala.
                    </p>
                    {!session.waiting_room_entered_at && (
                      <Button onClick={enterWaitingRoom} variant="outline">Entrar na sala de espera</Button>
                    )}
                    {session.waiting_room_entered_at && (
                      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                        Você está na sala de espera
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Jitsi video */}
          {callActive && (
            <div ref={jitsiContainerRef} className="flex-1 bg-black" />
          )}

          {/* Finished state */}
          {isFinished && !callActive && (
            <div className="flex-1 flex items-center justify-center bg-muted/30">
              <div className="text-center space-y-4 p-6 max-w-md">
                <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-10 w-10 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold">Teleconsulta Finalizada</h2>
                <p className="text-muted-foreground">
                  Duração: {session.duration_seconds ? `${Math.floor(session.duration_seconds / 60)}min` : "N/A"}
                </p>
                {hasTranscription && (
                  <p className="text-sm text-muted-foreground">
                    Transcrição e resumo disponíveis abaixo
                  </p>
                )}
                <Button variant="outline" onClick={() => navigate("/teleconsulta-hub")}>
                  Ver histórico
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Side panels */}
        {(transcriptionOpen || chatOpen) && (
          <div className="w-96 border-l flex flex-col overflow-hidden">
            <Tabs value={transcriptionOpen ? "transcription" : "chat"} className="flex-1 flex flex-col">
              <TabsList className="w-full grid grid-cols-2 shrink-0">
                <TabsTrigger value="transcription" onClick={() => { setTranscriptionOpen(true); setChatOpen(false); }}>
                  <FileText className="h-4 w-4 mr-1.5" /> Transcrição
                </TabsTrigger>
                <TabsTrigger value="chat" onClick={() => { setChatOpen(true); setTranscriptionOpen(false); }}>
                  <MessageSquare className="h-4 w-4 mr-1.5" /> Chat
                </TabsTrigger>
              </TabsList>

              {/* Transcription panel */}
              <TabsContent value="transcription" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=active]:flex">
                <div className="p-3 border-b space-y-2 shrink-0">
                  {callActive && !isTranscribing && (
                    <Button size="sm" onClick={startTranscription} className="w-full gap-2">
                      <Mic className="h-4 w-4" /> Iniciar Transcrição
                    </Button>
                  )}
                  {isTranscribing && (
                    <Button size="sm" variant="destructive" onClick={stopTranscription} className="w-full gap-2">
                      <MicOff className="h-4 w-4" /> Parar Transcrição
                    </Button>
                  )}
                  {hasTranscription && !generatingSummary && !clinicalSummary && (
                    <Button size="sm" variant="outline" onClick={generateSummary} className="w-full gap-2">
                      <Sparkles className="h-4 w-4" /> Gerar Resumo IA
                    </Button>
                  )}
                  {generatingSummary && (
                    <Button size="sm" variant="outline" disabled className="w-full gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" /> Gerando resumo...
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-4">
                    {clinicalSummary && (
                      <Card className="border-primary/20 bg-primary/5">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-primary" /> Resumo Clínico (IA)
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                          <div className="prose prose-sm max-w-none">
                            <ReactMarkdown>{clinicalSummary}</ReactMarkdown>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {hasTranscription && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase">Transcrição em tempo real</p>
                        {transcriptLines.map((line, i) => (
                          <p key={i} className="text-sm font-mono text-muted-foreground leading-relaxed">
                            {line}
                          </p>
                        ))}
                        {interimText && (
                          <p className="text-sm font-mono text-muted-foreground/60 italic leading-relaxed">
                            {interimText}
                          </p>
                        )}
                        <div ref={transcriptEndRef} />
                      </div>
                    )}

                    {!hasTranscription && !clinicalSummary && (
                      <div className="text-center py-8 text-muted-foreground text-sm">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        Nenhuma transcrição disponível
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Chat panel */}
              <TabsContent value="chat" className="flex-1 flex flex-col overflow-hidden m-0 data-[state=active]:flex">
                <ScrollArea className="flex-1 p-3">
                  <div className="space-y-3">
                    {chatMessages.map((msg) => (
                      <div key={msg.id} className={`flex flex-col gap-1 ${msg.sender_id === user?.id ? "items-end" : "items-start"}`}>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <span className="font-medium">{msg.sender_name}</span>
                          <span>•</span>
                          <span>{format(new Date(msg.created_at), "HH:mm")}</span>
                        </div>
                        <div className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                          msg.sender_id === user?.id
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                </ScrollArea>
                <div className="p-3 border-t shrink-0">
                  <div className="flex gap-2">
                    <Input
                      placeholder="Digite sua mensagem..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
                    />
                    <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>

      {/* Dialog de notas pós-consulta */}
      <Dialog open={showNotesDialog} onOpenChange={setShowNotesDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Finalizar Teleconsulta</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Resumo Clínico (gerado por IA)</Label>
              <div className="p-4 bg-muted rounded-lg text-sm whitespace-pre-wrap max-h-60 overflow-y-auto">
                {clinicalSummary || "Nenhum resumo gerado ainda"}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações e Anotações Adicionais</Label>
              <Textarea
                id="notes"
                placeholder="Adicione observações, orientações ou informações complementares..."
                value={postConsultNotes}
                onChange={(e) => setPostConsultNotes(e.target.value)}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowNotesDialog(false);
              navigate("/teleconsulta-hub");
            }}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEvolution} disabled={isSavingEvolution}>
              {isSavingEvolution ? "Salvando..." : "Salvar no Prontuário"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
