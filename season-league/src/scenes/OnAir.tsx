import { type FormEvent, useEffect, useRef, useState } from "react";
import { captainFor } from "../engine/season.ts";
import { InputCards } from "../components/InputCards.tsx";
import { promisesFrom, useGame } from "../store/game.ts";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function getRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

/** On air: the AI client with a lower-third, live commentary, speaker pick, and the promises being tracked. */
export function OnAir() {
  const round = useGame((s) => s.currentRound())!;
  const live = useGame((s) => s.season!.live!);
  const roster = useGame((s) => s.season!.roster);
  const content = useGame((s) => s.content);
  const thinking = useGame((s) => s.thinking);
  const sendTurn = useGame((s) => s.sendTurn);
  const dispatch = useGame((s) => s.dispatch);
  const character = content.characters[round.character]!;
  const captain = captainFor(roster, round.round);
  const [speaker, setSpeaker] = useState(captain?.name ?? roster[0]?.name ?? "");
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const logRef = useRef<HTMLOListElement>(null);
  const dictation = typeof window !== "undefined" && getRecognition() !== null;

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [live.transcript.length, thinking]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim() || thinking) return;
    void sendTurn(speaker, text);
    setText("");
  };

  const toggleDictation = () => {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const rec = getRecognition();
    if (!rec) return;
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.onresult = (ev) => setText((t) => `${t} ${ev.results[0][0].transcript}`.trim());
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setListening(true);
    rec.start();
  };

  const promises = promisesFrom(live.plan);
  const speakerRole = (name: string) => roster.find((m) => m.name === name)?.role;

  return (
    <div className="onair">
      <section className="frame" aria-label={`${character.name} on air`}>
        <div className="onair-tag">
          <span className="dot" aria-hidden="true" /> On air
        </div>
        <div className={`portrait${thinking ? " speaking" : ""}`} aria-hidden="true">
          <span className="display">{character.name.slice(0, 1)}</span>
        </div>
        <div className="lower-third">
          <span className="lt-name display">{character.name}</span>
          <span className="lt-role">
            {character.role}, {character.organisation}
            {character.location ? `, ${character.location}` : ""}
          </span>
        </div>
        <div className="tracking">
          <h2 className="display h4">{character.name} is tracking</h2>
          {promises.length === 0 ? (
            <p className="muted small">No written promises on the board.</p>
          ) : (
            <ul>
              {promises.map((p, i) => (
                <li key={i}>
                  <span>{p.action}</span>
                  <span className="muted small">
                    {p.owner}, by the {p.due}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="commentary" aria-label="Live commentary">
        <ol className="transcript" ref={logRef} aria-live="polite">
          {live.transcript.map((t, i) => (
            <li key={i} className={`line line-${t.who}`}>
              <span className="line-who">
                {t.who === "character"
                  ? character.name
                  : `${t.speaker}${speakerRole(t.speaker) ? `, ${speakerRole(t.speaker)}` : ""}`}
              </span>
              <span className="line-text">{t.text}</span>
            </li>
          ))}
          {thinking && (
            <li className="line line-character pending">
              <span className="line-who">{character.name}</span>
              <span className="line-text">On the line</span>
            </li>
          )}
        </ol>
        <form className="talkback" onSubmit={submit}>
          <div className="chips" role="radiogroup" aria-label="Who is speaking">
            {roster.map((m) => (
              <button
                type="button"
                key={m.name}
                role="radio"
                aria-checked={speaker === m.name}
                className="chip"
                onClick={() => setSpeaker(m.name)}
              >
                {m.name}
              </button>
            ))}
          </div>
          <div className="talk-row">
            <label className="sr-only" htmlFor="talk">
              What {speaker} says
            </label>
            <textarea
              id="talk"
              value={text}
              rows={2}
              placeholder={`${speaker} speaks to ${character.name}`}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) submit(e);
              }}
            />
            {dictation && (
              <button type="button" className="btn-ghost" aria-pressed={listening} onClick={toggleDictation}>
                {listening ? "Stop" : "Dictate"}
              </button>
            )}
            <button type="submit" className="btn-primary" disabled={!text.trim() || thinking}>
              Say it
            </button>
          </div>
        </form>
        <button
          type="button"
          className="btn-ghost end-call"
          onClick={() => dispatch({ type: "END_CALL", now: Date.now() })}
        >
          End the call
        </button>
      </section>
      <InputCards cards={round.inputCards} showAt="onair" />
    </div>
  );
}
