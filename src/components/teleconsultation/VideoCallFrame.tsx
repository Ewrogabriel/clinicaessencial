import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Phone, Mic, MicOff, Video, VideoOff, Monitor,
  Circle, FileText, Camera, StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoCallFrameProps {
  sessionId: string;
  onEnd: () => void;
  onRecord?: () => void;
}

function useElapsedTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [active]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const display = h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;

  return { display, seconds };
}

export function VideoCallFrame({ sessionId, onEnd, onRecord }: VideoCallFrameProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const { display: elapsed } = useElapsedTimer(true);

  const handleRecord = () => {
    setIsRecording((prev) => !prev);
    onRecord?.();
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-full bg-gray-950 rounded-xl overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-black/40 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-white text-xs font-medium">Em andamento</span>
            <span className="text-gray-400 text-xs font-mono ml-2">{elapsed}</span>
          </div>
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 font-medium bg-red-950/40 px-2 py-0.5 rounded-full">
                <Circle className="h-2 w-2 fill-red-500 text-red-500 animate-pulse" />
                Gravando
              </span>
            )}
            <span className="text-gray-500 text-xs font-mono truncate max-w-[120px]">
              #{sessionId.slice(0, 8)}
            </span>
          </div>
        </div>

        {/* Video area */}
        <div className="flex flex-1 min-h-0 gap-1 p-1">
          {/* Main video */}
          <div
            className={cn(
              "relative flex-1 bg-gray-900 rounded-lg flex items-center justify-center transition-all",
              notesOpen && "flex-[2]"
            )}
          >
            {isVideoOff ? (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <VideoOff className="h-12 w-12" />
                <p className="text-sm">Câmera desligada</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 text-gray-600">
                <Camera className="h-16 w-16" />
                <p className="text-sm">
                  Integração de vídeo em tempo real
                </p>
                <p className="text-xs text-gray-700">
                  (Jitsi/WebRTC será renderizado aqui)
                </p>
              </div>
            )}

            {/* Self-view pip */}
            <div className="absolute bottom-3 right-3 w-24 h-16 bg-gray-800 rounded-lg border border-gray-700 flex items-center justify-center">
              <Camera className="h-5 w-5 text-gray-600" />
            </div>
          </div>

          {/* Notes panel */}
          {notesOpen && (
            <div className="w-72 bg-gray-900 rounded-lg flex flex-col border border-gray-800">
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800">
                <StickyNote className="h-4 w-4 text-primary" />
                <span className="text-white text-sm font-medium">Anotações</span>
              </div>
              <ScrollArea className="flex-1 p-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Anote observações durante a consulta..."
                  className="bg-gray-800 border-gray-700 text-white text-sm placeholder:text-gray-600 resize-none min-h-[300px]"
                />
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Controls toolbar */}
        <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/40 backdrop-blur-sm">
          {/* Mute */}
          <ControlButton
            active={isMuted}
            activeClass="bg-red-600 hover:bg-red-700"
            onClick={() => setIsMuted((v) => !v)}
            tooltip={isMuted ? "Ativar microfone" : "Silenciar"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </ControlButton>

          {/* Video */}
          <ControlButton
            active={isVideoOff}
            activeClass="bg-red-600 hover:bg-red-700"
            onClick={() => setIsVideoOff((v) => !v)}
            tooltip={isVideoOff ? "Ligar câmera" : "Desligar câmera"}
          >
            {isVideoOff ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />}
          </ControlButton>

          {/* Screen share */}
          <ControlButton
            active={isSharing}
            activeClass="bg-blue-600 hover:bg-blue-700"
            onClick={() => setIsSharing((v) => !v)}
            tooltip={isSharing ? "Parar compartilhamento" : "Compartilhar tela"}
          >
            <Monitor className="h-4 w-4" />
          </ControlButton>

          {/* Record */}
          <ControlButton
            active={isRecording}
            activeClass="bg-red-700 hover:bg-red-800"
            onClick={handleRecord}
            tooltip={isRecording ? "Parar gravação" : "Gravar sessão"}
          >
            <Circle className={cn("h-4 w-4", isRecording && "fill-current")} />
          </ControlButton>

          {/* Notes */}
          <ControlButton
            active={notesOpen}
            activeClass="bg-primary/80 hover:bg-primary"
            onClick={() => setNotesOpen((v) => !v)}
            tooltip="Anotações"
          >
            <FileText className="h-4 w-4" />
          </ControlButton>

          {/* End call */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                className="h-11 w-11 rounded-full bg-red-600 hover:bg-red-700 text-white ml-3"
                onClick={onEnd}
              >
                <Phone className="h-5 w-5 rotate-[135deg]" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Encerrar chamada</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </TooltipProvider>
  );
}

function ControlButton({
  children,
  active,
  activeClass,
  onClick,
  tooltip,
}: {
  children: React.ReactNode;
  active: boolean;
  activeClass: string;
  onClick: () => void;
  tooltip: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className={cn(
            "h-10 w-10 rounded-full text-gray-300 hover:text-white hover:bg-white/10",
            active && activeClass
          )}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tooltip}</TooltipContent>
    </Tooltip>
  );
}
