import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Upload, FileText, Image, File, Trash2, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PatientAttachmentsProps {
  pacienteId: string;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  image: <Image className="h-5 w-5 text-blue-500" />,
  pdf: <FileText className="h-5 w-5 text-red-500" />,
  default: <File className="h-5 w-5 text-muted-foreground" />,
};

function getFileIcon(type: string | null) {
  if (!type) return FILE_ICONS.default;
  if (type.startsWith("image/")) return FILE_ICONS.image;
  if (type === "application/pdf") return FILE_ICONS.pdf;
  return FILE_ICONS.default;
}

function formatFileSize(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const PatientAttachments = ({ pacienteId }: PatientAttachmentsProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [descricao, setDescricao] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["patient-attachments", pacienteId],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("patient_attachments")
        .select("*")
        .eq("paciente_id", pacienteId)
        .order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return data || [];
    },
    enabled: !!pacienteId,
  });

  const deleteMutation = useMutation({
    mutationFn: async (attachment: any) => {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from("patient-documents")
        .remove([attachment.file_path]);
      if (storageError) console.warn("Storage delete error:", storageError);

      // Delete from DB
      const { error } = await (supabase
        .from("patient_attachments")
        .delete()
        .eq("id", attachment.id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["patient-attachments", pacienteId] });
      toast.success("Anexo removido.");
      setDeletingId(null);
    },
    onError: (e: any) => toast.error("Erro ao remover: " + e.message),
  });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop();
        const filePath = `${pacienteId}/${Date.now()}_${file.name}`;

        const { error: uploadError } = await supabase.storage
          .from("patient-documents")
          .upload(filePath, file);
        if (uploadError) throw uploadError;

        const { error: dbError } = await (supabase
          .from("patient_attachments")
          .insert({
            paciente_id: pacienteId,
            uploaded_by: user.id,
            file_name: file.name,
            file_path: filePath,
            file_type: file.type,
            file_size: file.size,
            descricao: descricao.trim() || null,
          }) as any);
        if (dbError) throw dbError;
      }

      queryClient.invalidateQueries({ queryKey: ["patient-attachments", pacienteId] });
      toast.success("Arquivo(s) anexado(s) com sucesso!");
      setDescricao("");
    } catch (err: any) {
      toast.error("Erro no upload: " + err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDownload = async (attachment: any) => {
    const { data, error } = await supabase.storage
      .from("patient-documents")
      .createSignedUrl(attachment.file_path, 60);
    if (error || !data?.signedUrl) {
      toast.error("Erro ao gerar link de download.");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  const attachmentToDelete = attachments.find((a: any) => a.id === deletingId);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Documentos e Anexos</CardTitle>
          <CardDescription>Fotos, PDFs, exames e outros documentos do paciente</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload area */}
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="Descrição do arquivo (opcional)"
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            className="flex-1"
          />
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 mr-2" />
            )}
            {uploading ? "Enviando..." : "Anexar Arquivo"}
          </Button>
        </div>

        {/* File list */}
        {isLoading ? (
          <div className="text-center py-6 text-muted-foreground text-sm animate-pulse">Carregando anexos...</div>
        ) : attachments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <File className="h-10 w-10 mx-auto mb-3 opacity-20" />
            <p className="text-sm">Nenhum documento anexado.</p>
            <p className="text-xs mt-1">Clique em "Anexar Arquivo" para adicionar documentos, fotos ou PDFs.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {attachments.map((att: any) => (
              <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors">
                {getFileIcon(att.file_type)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{att.file_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{format(new Date(att.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
                    {att.file_size && <span>• {formatFileSize(att.file_size)}</span>}
                    {att.descricao && <span>• {att.descricao}</span>}
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(att)} title="Baixar">
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeletingId(att.id)} title="Excluir">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir anexo?</AlertDialogTitle>
            <AlertDialogDescription>
              O arquivo "{attachmentToDelete?.file_name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => attachmentToDelete && deleteMutation.mutate(attachmentToDelete)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
