import { toast } from "sonner";

export class AppError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public originalError?: any
    ) {
        super(message);
        this.name = "AppError";
    }
}

export const handleError = (error: any, customMessage?: string) => {
    console.error("App Error:", error);

    let message = customMessage || "Ocorreu um erro inesperado.";

    if (error instanceof AppError) {
        message = error.message;
    } else if (error?.message) {
        message = error.message;
    }

    toast.error(message, {
        description: error?.code ? `Código: ${error.code}` : undefined,
    });

    return new AppError(message, error?.code, error);
};
