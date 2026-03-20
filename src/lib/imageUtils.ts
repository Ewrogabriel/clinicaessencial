/**
 * Limpa uma imagem de assinatura (DataURL) removendo o fundo branco (tornando transparente),
 * aumentando o contraste e removendo espaços vazios nas bordas.
 */
export async function cleanSignatureImage(dataUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Não foi possível obter o contexto do Canvas"));
        return;
      }

      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Tornar fundo transparente e aumentar contraste
      // Consideramos "fundo" qualquer pixel muito claro (perto de 255)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Brilho simples (média)
        const brightness = (r + g + b) / 3;

        // Se for muito claro, torna transparente
        if (brightness > 220) {
          data[i + 3] = 0;
        } else {
          // Se for escuro, forçamos para preto puro para aumentar o contraste
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        }
      }
      ctx.putImageData(imageData, 0, 0);

      // 2. Trim (Cortar bordas vazias)
      const bounds = { top: null, left: null, right: null, bottom: null };
      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const alpha = data[(y * canvas.width + x) * 4 + 3];
          if (alpha > 0) {
            if (bounds.top === null) bounds.top = y;
            if (bounds.left === null || x < bounds.left) bounds.left = x;
            if (bounds.right === null || x > bounds.right) bounds.right = x;
            if (bounds.bottom === null || y > bounds.bottom) bounds.bottom = y;
          }
        }
      }

      if (bounds.top === null) {
        resolve(dataUrl); // Imagem vazia, retorna original
        return;
      }

      const trimWidth = bounds.right - bounds.left + 1;
      const trimHeight = bounds.bottom - bounds.top + 1;
      const trimmedCanvas = document.createElement("canvas");
      trimmedCanvas.width = trimWidth;
      trimmedCanvas.height = trimHeight;
      const trimmedCtx = trimmedCanvas.getContext("2d");
      
      if (trimmedCtx) {
        trimmedCtx.drawImage(canvas, bounds.left, bounds.top, trimWidth, trimHeight, 0, 0, trimWidth, trimHeight);
        resolve(trimmedCanvas.toDataURL("image/png"));
      } else {
        resolve(canvas.toDataURL("image/png"));
      }
    };
    img.onerror = () => reject(new Error("Erro ao carregar imagem"));
    img.src = dataUrl;
  });
}
