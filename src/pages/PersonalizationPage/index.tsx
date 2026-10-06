import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/primitives";
import { KeyboardSection } from "./KeyboardSection";
import { usePreferencesStore, type PanelLayout } from "@/stores/usePreferencesStore";

const SECTIONS = [
  { id: "panel-layout", label: "面板布局" },
  { id: "keyboard", label: "Keyboard" },
] as const;

function LayoutRow({ title, value, onChange }: {
  title: string;
  value: PanelLayout;
  onChange: (layout: PanelLayout) => void;
}) {
  return <div className="flex items-center justify-between gap-4 py-3">
    <span className="text-sm">{title}</span>
    <div role="group" aria-label={`${title}布局`} className="flex rounded-md border border-border dark:border-border-dark p-0.5 gap-0.5">
      {([{ value: "drawer", label: "抽屉" }, { value: "modal", label: "弹窗" }] as const).map(option =>
        <button key={option.value} aria-pressed={value === option.value} onClick={() => onChange(option.value)}
          className={`px-3 py-1.5 text-sm rounded cursor-pointer transition-colors ${value === option.value ? "bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark" : "text-text-secondary dark:text-text-secondary-dark hover:bg-bg dark:hover:bg-bg-dark"}`}>
          {option.label}
        </button>)}
    </div>
  </div>;
}

export function PersonalizationPage() {
  const navigate = useNavigate();
  const noteDetailLayout = usePreferencesStore(s => s.noteDetailLayout);
  const setNoteDetailLayout = usePreferencesStore(s => s.setNoteDetailLayout);
  const chatLayout = usePreferencesStore(s => s.chatLayout);
  const setChatLayout = usePreferencesStore(s => s.setChatLayout);
  const contentRef = useRef<HTMLElement>(null);
  const [activeSection, setActiveSection] = useState<string>("panel-layout");

  function updateActiveSection() {
    const content = contentRef.current;
    if (!content) return;
    const top = content.getBoundingClientRect().top + 32;
    let active: string = SECTIONS[0].id;
    for (const section of SECTIONS) {
      const element = content.querySelector<HTMLElement>(`#${section.id}`);
      if (element && element.getBoundingClientRect().top <= top) active = section.id;
    }
    setActiveSection(active);
  }

  return <div className="flex flex-col h-screen w-screen overflow-hidden bg-bg dark:bg-bg-dark text-text dark:text-text-dark font-serif">
    <header className="shrink-0 bg-surface dark:bg-surface-dark border-b border-border dark:border-border-dark">
      <div className="flex items-center gap-3 px-6 py-4 max-w-[1200px] mx-auto w-full">
        <Button variant="icon" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={18} /></Button>
        <h1 className="text-xl font-semibold text-text dark:text-text-dark tracking-tight m-0">个性化</h1>
      </div>
    </header>
    <div className="flex-1 min-h-0 flex flex-col sm:flex-row w-full max-w-[1000px] mx-auto">
      <aside className="shrink-0 sm:w-44 border-b sm:border-b-0 sm:border-r border-border dark:border-border-dark p-3 sm:py-6 font-sans">
        <nav aria-label="个性化目录" className="flex sm:flex-col gap-1 overflow-x-auto">
          {SECTIONS.map(section => <a key={section.id} href={`#${section.id}`} aria-current={activeSection === section.id ? "location" : undefined}
            className={`rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors ${activeSection === section.id ? "bg-accent/10 dark:bg-accent-dark/10 text-accent dark:text-accent-dark font-medium" : "text-text-secondary dark:text-text-secondary-dark hover:bg-surface dark:hover:bg-surface-dark"}`}
            onClick={event => {
              event.preventDefault();
              setActiveSection(section.id);
              contentRef.current?.querySelector(`#${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
            }}>{section.label}</a>)}
        </nav>
      </aside>
      <main ref={contentRef} onScroll={updateActiveSection} className="flex-1 min-h-0 min-w-0 overflow-y-auto p-6">
        <div className="max-w-[650px] mx-auto flex flex-col gap-8">
          <section id="panel-layout" className="scroll-mt-6 rounded-xl border border-border dark:border-border-dark bg-surface dark:bg-surface-dark p-5 font-sans">
            <h2 className="text-base font-medium m-0 mb-2">面板布局</h2>
            <div className="divide-y divide-border dark:divide-border-dark">
              <LayoutRow title="Note Detail" value={noteDetailLayout} onChange={setNoteDetailLayout} />
              <LayoutRow title="AI Chat" value={chatLayout} onChange={setChatLayout} />
            </div>
          </section>
          <KeyboardSection />
        </div>
      </main>
    </div>
  </div>;
}
