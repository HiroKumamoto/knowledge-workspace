import React, { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Edit3, Trash2, Search, FolderPlus, Save, X, Check, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// shadcn/ui components (available in this environment)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// --- Types

type Note = {
  id: string;
  title: string;
  content: string;
  updatedAt: number; // epoch ms
};

type Project = {
  id: string;
  name: string;
  notes: Note[];
};

// --- Helpers
const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const fmtDate = (ms: number) => new Date(ms).toLocaleString();

const STORAGE_KEY = "knowledge_workspace_state_v1";

// Seed data for first launch
const seed: Project[] = [
  {
    id: uid(),
    name: "プロジェクトA",
    notes: [
      { id: uid(), title: "キックオフメモ", content: "目的、スコープ、メンバー、タイムライン。", updatedAt: Date.now() - 1000 * 60 * 60 * 24 },
      { id: uid(), title: "要件まとめ", content: "必須/任意、非機能、制約。", updatedAt: Date.now() - 1000 * 60 * 60 * 2 }
    ]
  },
  {
    id: uid(),
    name: "プロジェクトB",
    notes: [
      { id: uid(), title: "リサーチログ", content: "競合、参考リンク、学び。", updatedAt: Date.now() - 1000 * 60 * 30 }
    ]
  }
];

// --- Main Component
export default function KnowledgeWorkspace() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [isNoteDialogOpen, setNoteDialogOpen] = useState(false);
  const [draft, setDraft] = useState<{ id?: string; title: string; content: string }>({ title: "", content: "" });
  const [renameProjectId, setRenameProjectId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");

  // Load / Save persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Project[];
        setProjects(parsed);
        setActiveProjectId(parsed[0]?.id ?? null);
        setSelectedNoteId(parsed[0]?.notes[0]?.id ?? null);
        return;
      }
    } catch {}
    // first time
    setProjects(seed);
    setActiveProjectId(seed[0].id);
    setSelectedNoteId(seed[0].notes[0]?.id ?? null);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch {}
  }, [projects]);

  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);
  const selectedNote = useMemo(() => activeProject?.notes.find(n => n.id === selectedNoteId) || null, [activeProject, selectedNoteId]);

  // Derived filtered notes
  const filteredNotes = useMemo(() => {
    const list = activeProject?.notes ?? [];
    if (!query.trim()) return list.sort((a,b) => b.updatedAt - a.updatedAt);
    const q = query.toLowerCase();
    return list.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)).sort((a,b)=> b.updatedAt - a.updatedAt);
  }, [activeProject, query]);

  // --- Actions
  const addProject = () => {
    const p: Project = { id: uid(), name: `新規プロジェクト`, notes: [] };
    setProjects(prev => [p, ...prev]);
    setActiveProjectId(p.id);
    setSelectedNoteId(null);
    setRenameProjectId(p.id);
    setProjectNameDraft(p.name);
  };

  const renameProject = (id: string, name: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
  };

  const deleteProject = (id: string) => {
    const ok = confirm("このプロジェクトを削除しますか？（元に戻せません）");
    if (!ok) return;
    setProjects(prev => prev.filter(p => p.id !== id));
    if (activeProjectId === id) {
      const remaining = projects.filter(p => p.id !== id);
      setActiveProjectId(remaining[0]?.id ?? null);
      setSelectedNoteId(remaining[0]?.notes[0]?.id ?? null);
    }
  };

  const openNewNote = () => {
    setDraft({ title: "", content: "" });
    setNoteDialogOpen(true);
  };

  const openEditNote = (note: Note) => {
    setDraft({ id: note.id, title: note.title, content: note.content });
    setNoteDialogOpen(true);
  };

  const saveNote = () => {
    if (!activeProject) return;
    const now = Date.now();
    if (!draft.title.trim()) {
      alert("タイトルを入力してください");
      return;
    }
    setProjects(prev => prev.map(p => {
      if (p.id !== activeProject.id) return p;
      if (draft.id) {
        // update
        const notes = p.notes.map(n => n.id === draft.id ? { ...n, title: draft.title.trim(), content: draft.content, updatedAt: now } : n);
        return { ...p, notes };
      }
      // create
      const newNote: Note = { id: uid(), title: draft.title.trim(), content: draft.content, updatedAt: now };
      return { ...p, notes: [newNote, ...p.notes] };
    }));
    setNoteDialogOpen(false);
  };

  const deleteNote = (id: string) => {
    if (!activeProject) return;
    const ok = confirm("この項目を削除しますか？");
    if (!ok) return;
    setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, notes: p.notes.filter(n => n.id !== id) } : p));
    if (selectedNoteId === id) setSelectedNoteId(null);
  };

  // --- UI Pieces
  function ProjectTabs() {
    return (
      <div className="w-full border-b bg-white/70 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 overflow-x-auto">
          <span className="font-semibold mr-2">プロジェクト:</span>
          <div className="flex gap-2 items-center">
            {projects.map(p => (
              <button
                key={p.id}
                onClick={() => { setActiveProjectId(p.id); setSelectedNoteId(projects.find(x=>x.id===p.id)?.notes[0]?.id ?? null); }}
                className={`px-3 py-1.5 rounded-2xl border transition shadow-sm text-sm whitespace-nowrap ${activeProjectId===p.id ? 'bg-slate-900 text-white border-slate-900' : 'bg-white hover:bg-slate-50 border-slate-200'}`}
                title={p.name}
              >
                <span className="align-middle">{p.name}</span>
              </button>
            ))}
            <Button size="sm" variant="outline" className="rounded-2xl" onClick={addProject}>
              <Plus className="w-4 h-4 mr-1"/> 新規
            </Button>
            {activeProject && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="ghost" className="rounded-2xl">設定 <ChevronDown className="w-4 h-4 ml-1"/></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuLabel>このプロジェクト</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setRenameProjectId(activeProject.id); setProjectNameDraft(activeProject.name); }}>名前を変更</DropdownMenuItem>
                  <DropdownMenuItem className="text-red-600" onClick={() => deleteProject(activeProject.id)}>削除</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>
    );
  }

  function RenameProjectInline() {
    if (!renameProjectId) return null;
    const p = projects.find(p=>p.id===renameProjectId);
    if (!p) return null;
    return (
      <div className="max-w-6xl mx-auto px-4 py-2">
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center gap-2">
            <Input value={projectNameDraft} onChange={e=>setProjectNameDraft(e.target.value)} className="max-w-sm" placeholder="プロジェクト名"/>
            <Button size="sm" onClick={()=>{ renameProject(p.id, projectNameDraft.trim() || p.name); setRenameProjectId(null); }}>
              <Check className="w-4 h-4 mr-1"/> 保存
            </Button>
            <Button size="sm" variant="ghost" onClick={()=> setRenameProjectId(null)}>
              <X className="w-4 h-4 mr-1"/> キャンセル
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  function Sidebar() {
    return (
      <div className="w-full md:w-80 border-l bg-white">
        <div className="p-3 border-b flex gap-2 items-center">
          <Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="検索（タイトル・本文）" className="text-sm"/>
          <Button size="icon" variant="outline"><Search className="w-4 h-4"/></Button>
        </div>
        <div className="p-3">
          <Button className="w-full" onClick={openNewNote}>
            <FolderPlus className="w-4 h-4 mr-1"/> [add] 追加
          </Button>
        </div>
        <ScrollArea className="h-[calc(100vh-220px)]">
          <ul className="p-2 space-y-1">
            {filteredNotes.map(n => (
              <li key={n.id}>
                <button
                  className={`w-full text-left px-3 py-2 rounded-lg border transition ${selectedNoteId===n.id ? 'bg-slate-100 border-slate-300' : 'hover:bg-slate-50 border-slate-200'}`}
                  onClick={() => setSelectedNoteId(n.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium truncate">{n.title}</span>
                    <Badge variant="secondary" className="ml-2 shrink-0">{new Date(n.updatedAt).toLocaleDateString()}</Badge>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1">{n.content || "(本文なし)"}</p>
                </button>
              </li>
            ))}
            {filteredNotes.length === 0 && (
              <li className="text-sm text-slate-500 p-3">まだ項目がありません。右上の[add]から追加してください。</li>
            )}
          </ul>
        </ScrollArea>
      </div>
    );
  }

  function NoteHeader() {
    if (!selectedNote) return (
      <div className="p-6 text-slate-500">左の索引から項目を選ぶか、[add]で新規作成してください。</div>
    );
    return (
      <div className="flex items-center justify-between p-4 border-b">
        <div>
          <h2 className="text-xl font-semibold">{selectedNote.title}</h2>
          <p className="text-xs text-slate-500">更新: {fmtDate(selectedNote.updatedAt)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={()=> openEditNote(selectedNote)}>
            <Edit3 className="w-4 h-4 mr-1"/> [edit]
          </Button>
          <Button size="sm" variant="ghost" className="text-red-600" onClick={()=> deleteNote(selectedNote.id)}>
            <Trash2 className="w-4 h-4 mr-1"/> [delete]
          </Button>
        </div>
      </div>
    );
  }

  function NoteBody() {
    if (!selectedNote) return null;
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-slate-700">本文</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="whitespace-pre-wrap leading-7">{selectedNote.content || "(本文なし)"}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  function NoteDialog() {
    return (
      <Dialog open={isNoteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{draft.id ? "編集" : "追加"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="タイトル" value={draft.title} onChange={e=> setDraft(d=> ({...d, title: e.target.value}))} />
            <Textarea placeholder="内容" value={draft.content} onChange={e=> setDraft(d=> ({...d, content: e.target.value}))} className="min-h-[200px]" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={()=> setNoteDialogOpen(false)}>キャンセル</Button>
            <Button onClick={saveNote}><Save className="w-4 h-4 mr-1"/> 保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white text-slate-900">
      {/* Top Bar & Tabs */}
      <div className="sticky top-0 z-40 border-b bg-white/80 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white grid place-items-center font-bold">K</div>
            <div>
              <div className="font-semibold leading-tight">Knowledge Workspace</div>
              <div className="text-xs text-slate-500">軽量ナレッジ共有ツール（Notion風）</div>
            </div>
          </div>
          {activeProject && (
            <div className="hidden md:flex items-center gap-3">
              <span className="text-sm text-slate-500">現在: <b>{activeProject.name}</b></span>
              <Button size="sm" onClick={openNewNote}>
                <Plus className="w-4 h-4 mr-1"/> [add]
              </Button>
            </div>
          )}
        </div>
        <ProjectTabs />
      </div>

      {/* Inline project rename */}
      <RenameProjectInline />

      {/* Main body */}
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-[1fr_320px] gap-0">
        <div className="min-h-[60vh]">
          <NoteHeader />
          <NoteBody />
        </div>
        <Sidebar />
      </div>

      <NoteDialog />
    </div>
  );
}