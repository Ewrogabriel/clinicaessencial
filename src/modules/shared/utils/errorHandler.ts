import { toast } from "sonner";

export class AppError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public originalError?: unknown
    ) {
        super(message);
        this.name = "AppError";
    }
}

export const handleError = (error: unknown, customMessage?: string) => {
    console.error("App Error:", error);

    let message = customMessage || "Ocorreu um erro inesperado.";

    if (error instanceof AppError) {
        message = error.message;
    } else if (error instanceof Error) {
        message = error.message;
    }

    const code = (error as { code?: string })?.code;

    toast.error(message, {
        description: code ? `Código: ${code}` : undefined,
    });

    return new AppError(message, code, error);
};
