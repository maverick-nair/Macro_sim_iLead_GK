import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Game } from "./App.tsx";
import { Stage } from "./components/Stage.tsx";
import { loadContent } from "./content/load.ts";
import { SharedScreen } from "./screen/SharedScreen.tsx";
import { useGame } from "./store/game.ts";
import "./styles.css";

const loaded = loadContent();
const root = createRoot(document.getElementById("root")!);

if (!loaded.ok) {
  root.render(
    <div className="content-error">
      <h1>Content failed validation</h1>
      <ul>
        {loaded.errors.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </div>,
  );
} else {
  useGame.setState({ content: loaded.content, unlockAt: loaded.unlockAt });
  const isScreen = window.location.pathname.replace(/\/$/, "") === "/screen";
  root.render(
    <StrictMode>
      {isScreen ? (
        <Stage width={1920} height={1080}>
          <SharedScreen />
        </Stage>
      ) : (
        <Game />
      )}
    </StrictMode>,
  );
}
