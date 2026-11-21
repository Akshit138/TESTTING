import { useEffect, useMemo, useState } from "react";
import { Bell, Bot, Clock3, Moon, Play, Send, Sun, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SubjectDraft } from "@/components/studymate/study-data";

type Reminder = { id: string; title: string; at: string; notified?: boolean };
type ChatMessage = { role: "user" | "assistant"; text: string };

const readStorage = <T,>(key: string, fallback: T): T => {
  if (typeof window === "undefined") return fallback;
  try { const value = localStorage.getItem(key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
};

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}

function makeReply(message: string, subjects: SubjectDraft[]) {
  const q = message.toLowerCase();
  if (q.includes("plan") || q.includes("timetable") || q.includes("schedule")) {
    return subjects.length
      ? `Here is a simple starting point: study ${subjects[0]?.name} first for 45 minutes, take a 10-minute break, then spend 30 minutes on ${subjects[1]?.name ?? "practice questions"}. Track each session in the revision timer and adjust based on your progress.`
      : "Add your subjects in the study planner first. Then I can suggest a revision order.";
  }
  if (q.includes("focus") || q.includes("concentrat") || q.includes("procrastinat")) return "Try one 25-minute focus session: choose a single small task, put your phone away, and take a 5-minute break when the timer ends. Start small rather than waiting to feel motivated.";
  if (q.includes("revision") || q.includes("revise") || q.includes("remember")) return "Use active recall: close your notes, write what you remember, check the gaps, and revisit those gaps tomorrow. Finish with a few practice questions.";
  if (q.includes("exam") || q.includes("stress") || q.includes("anxious")) return "Break exam preparation into today's next three tasks. Start with the topic you find hardest, use timed practice, and protect short breaks and sleep. You do not need to solve everything at once.";
  if (q.includes("hello") || q.includes("hi") || q.includes("hey")) return "Hey! I'm your study buddy. Ask me for a revision strategy, focus tips, or help organizing your subjects.";
  return "I can help with revision techniques, focus strategies, exam preparation, and study planning. Try asking: “How should I revise for my exam?” or “Make me a study timetable.”";
}

interface StudyToolsProps {
  subjects: SubjectDraft[];
  darkMode: boolean;
  onToggleTheme: () => void;
}

export function StudyTools({ subjects, darkMode, onToggleTheme }: StudyToolsProps) {
  const [totals, setTotals] = useState<Record<string, number>>(() => readStorage("padhlo-revision-totals", {}));
  const [selected, setSelected] = useState(subjects[0]?.id ?? "");
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [sessionStart, setSessionStart] = useState<number | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>(() => readStorage("padhlo-reminders", []));
  const [reminderTitle, setReminderTitle] = useState("");
  const [reminderAt, setReminderAt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", text: "Hi! I'm your study buddy. Ask me about revision, focus, exams, or planning your study time." }]);
  const [draft, setDraft] = useState("");

  const selectedName = useMemo(() => subjects.find((s) => s.id === selected)?.name ?? "Study session", [subjects, selected]);

  useEffect(() => {
    if (!running) return;
    const tick = () => setElapsed(Math.floor((Date.now() - (sessionStart ?? Date.now())) / 1000));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [running, sessionStart]);

  useEffect(() => { localStorage.setItem("padhlo-revision-totals", JSON.stringify(totals)); }, [totals]);
  useEffect(() => { localStorage.setItem("padhlo-reminders", JSON.stringify(reminders)); }, [reminders]);

  useEffect(() => {
    const check = () => {
      const now = Date.now();
      setReminders((items) => items.map((item) => {
        if (!item.notified && new Date(item.at).getTime() <= now) {
          if ("Notification" in window && Notification.permission === "granted") new Notification("Padhlo study reminder", { body: item.title });
          return { ...item, notified: true };
        }
        return item;
      }));
    };
    const id = window.setInterval(check, 15000);
    check();
    return () => window.clearInterval(id);
  }, []);

  function startTimer() {
    if (!selected) return;
    setElapsed(0);
    setSessionStart(Date.now());
    setRunning(true);
  }
  function stopTimer() {
    if (running && selected) setTotals((current) => ({ ...current, [selected]: (current[selected] ?? 0) + elapsed }));
    setRunning(false);
    setSessionStart(null);
    setElapsed(0);
  }
  async function addReminder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!reminderTitle.trim() || !reminderAt) return;
    if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    setReminders((items) => [...items, { id: `${Date.now()}`, title: reminderTitle.trim(), at: new Date(reminderAt).toISOString() }].sort((a, b) => a.at.localeCompare(b.at)));
    setReminderTitle("");
    setReminderAt("");
  }
  function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setMessages((items) => [...items, { role: "user", text }, { role: "assistant", text: makeReply(text, subjects) }]);
    setDraft("");
  }

  return (
    <section className="tools-section" id="study-tools">
      <div className="study-container">
        <div className="tools-heading">
          <div><span className="section-kicker">STAY CONSISTENT</span><h2>Your study tools</h2><p>Track revision, set reminders, and get study guidance.</p></div>
          <Button type="button" variant="outline" className="theme-toggle" onClick={onToggleTheme}>
            {darkMode ? <Sun size={16} /> : <Moon size={16} />} {darkMode ? "Light mode" : "Dark mode"}
          </Button>
        </div>
        <div className="tools-grid">
          <article className="tool-card">
            <div className="tool-title"><Clock3 size={18} /><div><h3>Revision time tracker</h3><p>Record focused time by subject</p></div></div>
            <label className="tool-label" htmlFor="timer-subject">Subject</label>
            <select id="timer-subject" className="tool-input" value={selected} disabled={running} onChange={(e) => setSelected(e.target.value)}>
              {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
            </select>
            <div className="timer-display" aria-live="off">{formatDuration(elapsed)}</div>
            <div className="timer-actions">
              {!running ? <Button type="button" onClick={startTimer} disabled={!subjects.length}><Play size={15} /> Start revision</Button> : <Button type="button" variant="destructive" onClick={stopTimer}><Square size={14} /> Stop & save</Button>}
              <span className="timer-hint">{running ? `Tracking ${selectedName}` : "Stop the timer to save this session"}</span>
            </div>
            <div className="tracked-list">
              <strong>Total revision time</strong>
              {subjects.map((subject) => <div className="tracked-row" key={subject.id}><span>{subject.name}</span><b>{formatDuration(totals[subject.id] ?? 0)}</b></div>)}
              {!subjects.length && <p>Add a subject in your planner to start tracking.</p>}
            </div>
          </article>

          <article className="tool-card">
            <div className="tool-title"><Bell size={18} /><div><h3>Study reminders</h3><p>Schedule revision sessions and exam prep</p></div></div>
            <form className="reminder-form" onSubmit={addReminder}>
              <label className="tool-label" htmlFor="reminder-title">Reminder</label>
              <input id="reminder-title" className="tool-input" placeholder="e.g. Revise organic chemistry" value={reminderTitle} onChange={(e) => setReminderTitle(e.target.value)} required />
              <label className="tool-label" htmlFor="reminder-time">Date and time</label>
              <input id="reminder-time" className="tool-input" type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={reminderAt} onChange={(e) => setReminderAt(e.target.value)} required />
              <Button type="submit" className="reminder-submit"><Bell size={14} /> Add reminder</Button>
            </form>
            <div className="reminder-list">
              {reminders.length ? reminders.map((item) => <div className="reminder-row" key={item.id}><div><strong>{item.title}</strong><span>{new Date(item.at).toLocaleString()}</span></div><button type="button" aria-label={`Delete reminder ${item.title}`} onClick={() => setReminders((all) => all.filter((r) => r.id !== item.id))}>×</button></div>) : <p className="empty-hint">No reminders yet. Add one above.</p>}
            </div>
            <p className="tool-footnote">Keep this website open to receive scheduled browser notifications. Allow notifications when prompted.</p>
          </article>

          <article className="tool-card chat-card">
            <div className="tool-title"><Bot size={19} /><div><h3>Study buddy</h3><p>Instant help for common study questions</p></div><span className="local-badge">READY</span></div>
            <div className="chat-messages" aria-live="polite">
              {messages.map((message, index) => <div className={`chat-message ${message.role}`} key={index}><span>{message.role === "assistant" ? "Study buddy" : "You"}</span><p>{message.text}</p></div>)}
            </div>
            <form className="chat-form" onSubmit={sendMessage}>
              <input className="tool-input" aria-label="Ask your study buddy" placeholder="Ask about revision, focus, exams..." value={draft} onChange={(e) => setDraft(e.target.value)} />
              <Button type="submit" aria-label="Send message" disabled={!draft.trim()}><Send size={15} /></Button>
            </form>
            <p className="tool-footnote">This version uses built-in study guidance, not a live AI model. Connect an AI backend to enable open-ended AI answers.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
