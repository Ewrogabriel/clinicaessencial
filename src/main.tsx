import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
// Initialise i18next before the React tree renders so translations are
// available synchronously from the first render.
import "./i18n/i18n";

createRoot(document.getElementById("root")!).render(<App />);
