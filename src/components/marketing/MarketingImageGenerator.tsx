import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon, Loader2, Download, Copy, X } from "lucide-react";

interface MarketingImageGeneratorProps {
  /** The image suggestion text from the AI ad */
  prompt: string;
  /** Additional context for better image generation */
  context?: string;
}

export function MarketingImageGenerator({ prompt, context }: MarketingImageGeneratorProps) {
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const generateImage = async () => {
    setLoading(true);
    try {
      const fullPrompt = `Create a professional marketing image for a health clinic advertisement. 
Style: Modern, clean, professional, high quality.
Theme: ${prompt}
${context ? `Additional context: ${context}` : ""}
The image should be suitable for social media ads (Instagram, Facebook). 
No text in the image, only visual elements. Bright, inviting colors.`;

      const { data, error } = await supabase.functions.invoke("ai-generate-image", {
        body: { prompt: fullPrompt },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Aviso", description: data.error, variant: "destructive" });
        return;
      }

      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        setDialogOpen(true);
        toast({ title: "Imagem gerada com sucesso! 🎨" });
      }
    } catch (err: any) {
      console.error("Image generation error:", err);
      toast({
        title: "Erro ao gerar imagem",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const downloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `marketing-image-${Date.now()}.png`;
    a.target = "_blank";
    a.click();
  };

  const copyImageUrl = () => {
    if (!imageUrl) return;
    navigator.clipboard.writeText(imageUrl);
    toast({ title: "URL copiada!" });
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="gap-1"
        onClick={generateImage}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <ImageIcon className="h-3 w-3" />
        )}
        {loading ? "Gerando..." : "Gerar Imagem"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Imagem Gerada pela IA
            </DialogTitle>
          </DialogHeader>
          {imageUrl && (
            <div className="space-y-4">
              <div className="rounded-lg overflow-hidden border">
                <img
                  src={imageUrl}
                  alt="Imagem de marketing gerada por IA"
                  className="w-full h-auto"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={downloadImage} className="gap-2 flex-1">
                  <Download className="h-4 w-4" /> Baixar
                </Button>
                <Button variant="outline" onClick={copyImageUrl} className="gap-2 flex-1">
                  <Copy className="h-4 w-4" /> Copiar URL
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setImageUrl(null);
                    generateImage();
                  }}
                  disabled={loading}
                  className="gap-2"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔄"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Prompt: {prompt.substring(0, 120)}...
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
