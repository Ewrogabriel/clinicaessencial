import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Circle, Square, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionRecorderProps {
  sessionId: string;
  isRecording: boolean;
  onToggle: () => void;
}

interface RecordingMeta {
  startedAt: Date | null;
  stoppedAt: Date | null;
  durationSeconds: number;
}

function useDurationCounter(active: boolean) {
  const [seconds, setSeconds] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (active) {
      setSeconds(0);
      ref.current = setInterval(() => setSeconds((s) => s + 1), 1000);
    } else {
      if (ref.current) clearInterval(ref.current);
    }
    return () => {
      if (ref.current) clearInterval(ref.current);
    };
  }, [active]);

  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  const display = `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return { display, seconds };
}

export function SessionRecorder({ sessionId, isRecording, onToggle }: SessionRecorderProps) {
  const { display, seconds } = useDurationCounter(isRecording);
  const [meta, setMeta] = useState<RecordingMeta>({
    startedAt: null,
    stoppedAt: null,
    durationSeconds: 0,
  });

  useEffect(() => {
    if (isRecording) {
      setMeta({ startedAt: new Date(), stoppedAt: null, durationSeconds: 0 });
    } else if (meta.startedAt && !meta.stoppedAt) {
      setMeta((prev) => ({
        ...prev,
        stoppedAt: new Date(),
        durationSeconds: seconds,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRecording]);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border bg-card">
      {/* Status indicator */}
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isRecording ? (
          <>
            <Circle className="h-3 w-3 fill-red-500 text-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-red-600">Gravando</span>
          </>
        ) : meta.stoppedAt ? (
          <>
            <Square className="h-3 w-3 fill-gray-400 text-gray-400 shrink-0" />
            <span className="text-sm text-muted-foreground">Gravação encerrada</span>
          </>
        ) : (
          <>
            <Mic className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-sm text-muted-foreground">Gravação inativa</span>
          </>
        )}
      </div>

      {/* Duration */}
      <span
        className={cn(
          "font-mono text-sm tabular-nums shrink-0",
          isRecording ? "text-red-600 font-semibold" : "text-muted-foreground"
        )}
      >
        {isRecording ? display : meta.durationSeconds > 0
          ? `${String(Math.floor(meta.durationSeconds / 60)).padStart(2, "0")}:${String(meta.durationSeconds % 60).padStart(2, "0")}`
          : "00:00"
        }
      </span>

      {/* Toggle button */}
      <Button
        size="sm"
        variant={isRecording ? "destructive" : "outline"}
        className="gap-1.5 shrink-0"
        onClick={onToggle}
      >
        {isRecording ? (
          <>
            <Square className="h-3.5 w-3.5" />
            Parar
          </>
        ) : (
          <>
            <Circle className="h-3.5 w-3.5 fill-red-500 text-red-500" />
            Gravar
          </>
        )}
      </Button>

      {/* Session ID reference (hidden, kept in state) */}
      <span className="sr-only">Session: {sessionId}</span>
    </div>
  );
}
