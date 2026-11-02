import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Reports } from "./admin/Reports.tsx";
import { Setup } from "./admin/Setup.tsx";
import { Game } from "./App.tsx";
import { Stage } from "./components/Stage.tsx";
import { loadContent } from "./content/load.ts";
import { Observer } from "./observer/Observer.tsx";
import { SharedScreen } from "./screen/SharedScreen.tsx";
import { useGame } from "./store/game.ts";
import "./styles.css";

const root = createRoot(document.getElementById("root")!);
const path = window.location.pathname.replace(/\/$/, "") || "/";

async function boot() {
  // Setup and Reports work even when the content fails validation, so setup can fix it.
  if (path === "/setup")
    return root.render(
      <StrictMode>
        <Setup />
      </StrictMode>,
    );
  if (path === "/reports")
    return root.render(
      <StrictMode>
        <Reports />
      </StrictMode>,
    );

  const loaded = await loadContent();
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
    return;
  }
  useGame.setState({
    content: loaded.content,
    unlockAt: loaded.unlockAt,
    gapUnlockAt: loaded.gapUnlockAt,
    finalUnlockAt: loaded.finalUnlockAt,
  });
  if (path === "/screen")
    return root.render(
      <StrictMode>
        <Stage width={1920} height={1080}>
          <SharedScreen />
        </Stage>
      </StrictMode>,
    );
  if (path === "/observer")
    return root.render(
      <StrictMode>
        <Observer />
      </StrictMode>,
    );
  root.render(
    <StrictMode>
      <Game />
    </StrictMode>,
  );
}

void boot();
