"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { Plus, Edit3, Trash2, FolderPlus, Save, X, Check, ChevronDown, XCircle } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { supabase } from "@/lib/supabase";

// shadcn/ui components (available in this environment)
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { analyzeUrl, isValidUrl } from "@/lib/urlAnalyzer";


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
// const uid = () => (globalThis.crypto?.randomUUID?.() ?? `id_${Date.now()}_${Math.random().toString(36).slice(2)}`);
const fmtDate = (ms: number) => new Date(ms).toLocaleString();

// Database helper functions
async function loadProjects(): Promise<Project[]> {
  try {
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (projectsError) throw projectsError;

    const projects: Project[] = [];
    
    for (const project of projectsData || []) {
      const { data: notesData, error: notesError } = await supabase
        .from('notes')
        .select('*')
        .eq('project_id', project.id)
        .order('updated_at', { ascending: false });

      if (notesError) throw notesError;

      projects.push({
        id: project.id,
        name: project.name,
        notes: (notesData || []).map(note => ({
          id: note.id,
          title: note.title,
          content: note.content,
          updatedAt: new Date(note.updated_at).getTime()
        }))
      });
    }

    return projects;
  } catch (error) {
    console.error('Error loading projects:', error);
    return [];
  }
}

async function createProject(name: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('projects')
      .insert({ name })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating project:', error);
    return null;
  }
}

async function updateProject(id: string, name: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .update({ name })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating project:', error);
    return false;
  }
}

async function deleteProjectFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting project:', error);
    return false;
  }
}

async function createNote(projectId: string, title: string, content: string): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .insert({
        project_id: projectId,
        title,
        content
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  } catch (error) {
    console.error('Error creating note:', error);
    return null;
  }
}

async function updateNote(id: string, title: string, content: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .update({
        title,
        content,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error updating note:', error);
    return false;
  }
}

async function deleteNoteFromDB(id: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', id);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting note:', error);
    return false;
  }
}

// Image upload functions
async function uploadImage(file: File): Promise<string | null> {
  try {
    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      alert('画像サイズは5MB以下にしてください');
      return null;
    }

    // Check file type
    if (!file.type.startsWith('image/')) {
      alert('画像ファイルのみアップロード可能です');
      return null;
    }

    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

    const { error } = await supabase.storage
      .from('images')
      .upload(fileName, file);

    if (error) throw error;

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    console.error('Error uploading image:', error);
    alert('画像のアップロードに失敗しました');
    return null;
  }
}

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

  // Load data from Supabase
  useEffect(() => {
    async function loadData() {
      const projectsData = await loadProjects();
      setProjects(projectsData);
      setActiveProjectId(projectsData[0]?.id ?? null);
      setSelectedNoteId(projectsData[0]?.notes[0]?.id ?? null);
    }
    loadData();
  }, []);


  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId) || null, [projects, activeProjectId]);
  const selectedNote = useMemo(() => activeProject?.notes.find(n => n.id === selectedNoteId) || null, [activeProject, selectedNoteId]);

  // Derived filtered notes with debounced query
  const debouncedQuery = useMemo(() => query, [query]);
  
  const filteredNotes = useMemo(() => {
    const list = activeProject?.notes ?? [];
    if (!debouncedQuery.trim()) return list.sort((a,b) => b.updatedAt - a.updatedAt);
    const q = debouncedQuery.toLowerCase();
    return list.filter(n => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)).sort((a,b)=> b.updatedAt - a.updatedAt);
  }, [activeProject?.notes, debouncedQuery]);



  // --- Actions
  const addProject = async () => {
    const projectId = await createProject("新規プロジェクト");
    if (projectId) {
      const newProject: Project = { id: projectId, name: "新規プロジェクト", notes: [] };
      setProjects(prev => [newProject, ...prev]);
      setActiveProjectId(projectId);
      setSelectedNoteId(null);
      setRenameProjectId(projectId);
      setProjectNameDraft("新規プロジェクト");
    }
  };

  const renameProject = async (id: string, name: string) => {
    const success = await updateProject(id, name);
    if (success) {
      setProjects(prev => prev.map(p => p.id === id ? { ...p, name } : p));
    }
  };

  const deleteProject = async (id: string) => {
    const ok = confirm("このプロジェクトを削除しますか？（元に戻せません）");
    if (!ok) return;
    
    const success = await deleteProjectFromDB(id);
    if (success) {
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) {
        const remaining = projects.filter(p => p.id !== id);
        setActiveProjectId(remaining[0]?.id ?? null);
        setSelectedNoteId(remaining[0]?.notes[0]?.id ?? null);
      }
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


  const deleteNote = async (id: string) => {
    if (!activeProject) return;
    const ok = confirm("この項目を削除しますか？");
    if (!ok) return;
    
    const success = await deleteNoteFromDB(id);
    if (success) {
      setProjects(prev => prev.map(p => p.id === activeProject.id ? { ...p, notes: p.notes.filter(n => n.id !== id) } : p));
      if (selectedNoteId === id) setSelectedNoteId(null);
    }
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
    
    const handleSave = () => {
      const newName = projectNameInputRef.current?.value?.trim() || "";
      if (newName) {
        renameProject(p.id, newName);
      }
      setRenameProjectId(null);
    };

    const handleCancel = () => {
      setRenameProjectId(null);
      setProjectNameDraft("");
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        handleSave();
      } else if (e.key === 'Escape') {
        handleCancel();
      }
    };

    return (
      <div className="max-w-6xl mx-auto px-4 py-2">
        <Card className="border-dashed">
          <CardContent className="p-4 flex items-center gap-2">
            <Input 
              ref={projectNameInputRef}
              defaultValue={projectNameDraft} 
              onKeyDown={handleKeyPress}
              className="max-w-sm" 
              placeholder="プロジェクト名"
              autoFocus
            />
            <Button size="sm" onClick={handleSave}>
              <Check className="w-4 h-4 mr-1"/> 保存
            </Button>
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              <X className="w-4 h-4 mr-1"/> キャンセル
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Sidebar = React.memo(function Sidebar() {
    return (
      <div className="w-full md:w-80 border-l bg-white">
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
  });

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
          <CardContent className="pt-6">
            {selectedNote.content ? (
              <div className="prose prose-slate max-w-none leading-7">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[rehypeRaw, rehypeSanitize]}
                  components={{
                  a: ({ href, children, ...props }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                      {...props}
                    >
                      {children}
                    </a>
                  ),
                  img: ({ src, alt, ...props }) => {
                    const { width, height, ...imageProps } = props;
                    return (
                      <Image
                        src={typeof src === 'string' ? src : ''}
                        alt={alt || ''}
                        width={800}
                        height={600}
                        className="max-w-full h-auto rounded-lg shadow-sm my-4"
                        {...imageProps}
                      />
                    );
                  },
                  code: ({ className, children, ...props }) => {
                    const match = /language-(\w+)/.exec(className || '');
                    return match ? (
                      <code
                        className="block bg-slate-100 p-3 rounded-md text-sm font-mono overflow-x-auto"
                        {...props}
                      >
                        {children}
                      </code>
                    ) : (
                      <code
                        className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono"
                        {...props}
                      >
                        {children}
                      </code>
                    );
                  },
                  pre: ({ children, ...props }) => (
                    <pre className="bg-slate-100 p-3 rounded-md overflow-x-auto" {...props}>
                      {children}
                    </pre>
                  ),
                  blockquote: ({ children, ...props }) => (
                    <blockquote
                      className="border-l-4 border-slate-300 pl-4 italic text-slate-600"
                      {...props}
                    >
                      {children}
                    </blockquote>
                  ),
                  h1: ({ children, ...props }) => (
                    <h1 className="text-2xl font-bold mt-6 mb-4 text-slate-900" {...props}>
                      {children}
                    </h1>
                  ),
                  h2: ({ children, ...props }) => (
                    <h2 className="text-xl font-semibold mt-5 mb-3 text-slate-800" {...props}>
                      {children}
                    </h2>
                  ),
                  h3: ({ children, ...props }) => (
                    <h3 className="text-lg font-medium mt-4 mb-2 text-slate-700" {...props}>
                      {children}
                    </h3>
                  ),
                  ul: ({ children, ...props }) => (
                    <ul className="list-disc list-inside space-y-1 my-3" {...props}>
                      {children}
                    </ul>
                  ),
                  ol: ({ children, ...props }) => (
                    <ol className="list-decimal list-inside space-y-1 my-3" {...props}>
                      {children}
                    </ol>
                  ),
                  li: ({ children, ...props }) => (
                    <li className="break-words overflow-hidden text-ellipsis max-w-full" {...props}>
                      <span className="block truncate pr-2">{children}</span>
                    </li>
                  ),
                  table: ({ children, ...props }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full border border-slate-200" {...props}>
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children, ...props }) => (
                    <th className="border border-slate-200 px-3 py-2 bg-slate-50 font-semibold text-left" {...props}>
                      {children}
                    </th>
                  ),
                  td: ({ children, ...props }) => (
                    <td className="border border-slate-200 px-3 py-2" {...props}>
                      {children}
                    </td>
                  ),
                  }}
                >
                  {selectedNote.content}
                </ReactMarkdown>
              </div>
            ) : (
              <div className="text-slate-500 italic">(本文なし)</div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const titleInputRef = useRef<HTMLInputElement>(null);
  const contentInputRef = useRef<HTMLTextAreaElement>(null);
  const projectNameInputRef = useRef<HTMLInputElement>(null);

  function NoteDialog() {
    const [previewContent, setPreviewContent] = useState(draft.content);
    const [previewTitle, setPreviewTitle] = useState(draft.title);
    const [isUploading, setIsUploading] = useState(false);
    const [dragActive, setDragActive] = useState(false);
    const [isAnalyzingUrl, setIsAnalyzingUrl] = useState(false);

    const handleImageUpload = async (files: FileList) => {
      setIsUploading(true);
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const imageUrl = await uploadImage(file);
        
        if (imageUrl) {
          const markdown = `![${file.name}](${imageUrl})\n\n`;
          const currentContent = contentInputRef.current?.value || '';
          const newContent = currentContent + markdown;
          
          if (contentInputRef.current) {
            contentInputRef.current.value = newContent;
            setPreviewContent(newContent);
          }
        }
      }
      
      setIsUploading(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
      
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageUpload(files);
      }
    };

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setDragActive(false);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files) {
        handleImageUpload(files);
      }
    };

    const handleSave = async () => {
      if (!activeProject) return;
      const title = titleInputRef.current?.value?.trim() || "";
      const content = contentInputRef.current?.value || "";
      
      if (!title) {
        alert("タイトルを入力してください");
        return;
      }
      
      if (draft.id) {
        // update existing note
        const success = await updateNote(draft.id, title, content);
        if (success) {
          const now = Date.now();
          setProjects(prev => prev.map(p => {
            if (p.id !== activeProject.id) return p;
            const notes = p.notes.map(n => n.id === draft.id ? { ...n, title, content, updatedAt: now } : n);
            return { ...p, notes };
          }));
        }
      } else {
        // create new note
        const noteId = await createNote(activeProject.id, title, content);
        if (noteId) {
          const newNote: Note = { id: noteId, title, content, updatedAt: Date.now() };
          setProjects(prev => prev.map(p => 
            p.id === activeProject.id ? { ...p, notes: [newNote, ...p.notes] } : p
          ));
        }
      }
      
      setNoteDialogOpen(false);
    };

    return (
      <Dialog open={isNoteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] max-h-[90vh] p-0 sm:max-w-[90vw] overflow-hidden">
          <div className="flex flex-col h-full overflow-hidden">
            <DialogHeader className="px-4 py-3 border-b sm:px-6 sm:py-4">
              <DialogTitle className="text-lg sm:text-xl">{draft.id ? "編集" : "追加"}</DialogTitle>
              <DialogDescription className="text-sm">
                {draft.id ? "項目の内容を編集します。" : "新しい項目を追加します。"}
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 flex flex-col lg:grid lg:grid-cols-2 gap-0 overflow-hidden min-h-0">
              {/* 編集エリア */}
              <div 
                className={`flex flex-col flex-1 min-h-0 p-4 lg:p-6 lg:border-r border-b lg:border-b-0 ${dragActive ? 'bg-blue-50 border-blue-300' : ''}`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="text-sm font-medium text-slate-700">編集</div>
                  <div className="flex items-center gap-2">
                    {(isUploading || isAnalyzingUrl) && (
                      <div className="text-xs text-blue-600 flex items-center gap-1">
                        <div className="w-3 h-3 border border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <span className="hidden sm:inline">{isAnalyzingUrl ? 'URL解析中...' : 'アップロード中...'}</span>
                      </div>
                    )}
                    <label htmlFor="imageUpload" className="cursor-pointer">
                      <Button size="sm" variant="outline" asChild>
                        <div className="flex items-center gap-1">
                          <Plus className="w-3 h-3" />
                          <span className="text-xs">画像</span>
                        </div>
                      </Button>
                    </label>
                    <input
                      id="imageUpload"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileInput}
                      className="hidden"
                    />
                  </div>
                </div>
                <Input 
                  ref={titleInputRef}
                  placeholder="タイトル（URLを貼り付けると自動解析）" 
                  defaultValue={draft.title}
                  onChange={(e) => setPreviewTitle(e.target.value)}
                  onBlur={async (e) => {
                    const value = e.target.value.trim();
                    if (isValidUrl(value) && !contentInputRef.current?.value.trim()) {
                      setIsAnalyzingUrl(true);
                      try {
                        const result = await analyzeUrl(value);
                        if (!result.error) {
                          if (titleInputRef.current) {
                            titleInputRef.current.value = result.title;
                            setPreviewTitle(result.title);
                          }
                          if (contentInputRef.current) {
                            contentInputRef.current.value = result.content;
                            setPreviewContent(result.content);
                          }
                        } else {
                          alert(`URL解析エラー: ${result.error}`);
                        }
                      } catch (error) {
                        console.error('URL解析エラー:', error);
                      } finally {
                        setIsAnalyzingUrl(false);
                      }
                    }
                  }}
                  autoFocus
                  className="mb-3 sm:mb-4"
                  disabled={isAnalyzingUrl}
                />
                <div className="flex-1 relative min-h-[200px] lg:min-h-0">
                  <Textarea 
                    ref={contentInputRef}
                    placeholder="内容（マークダウン対応）" 
                    defaultValue={draft.content}
                    onChange={(e) => setPreviewContent(e.target.value)}
                    className="w-full h-full resize-none text-sm sm:text-base" 
                  />
                  {dragActive && (
                    <div className="absolute inset-0 bg-blue-50 bg-opacity-90 border-2 border-dashed border-blue-300 rounded flex items-center justify-center">
                      <div className="text-blue-600 text-center px-4">
                        <div className="text-base sm:text-lg font-semibold mb-1">📷 画像をドロップ</div>
                        <div className="text-xs sm:text-sm">5MB以下対応</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* プレビューエリア */}
              <div className="flex flex-col flex-1 min-h-0 p-4 lg:p-6 bg-slate-50 border-t lg:border-t-0 lg:border-l overflow-hidden">
                <div className="text-sm font-medium text-slate-700 mb-3">プレビュー</div>
                <div className="flex-1 border rounded-lg p-4 bg-white overflow-auto">
                  <h3 className="text-xl font-bold mb-4 text-slate-900 border-b pb-2">
                    {previewTitle || "タイトル"}
                  </h3>
                  {previewContent ? (
                    <div className="prose prose-slate max-w-none">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw, rehypeSanitize]}
                        components={{
                          a: ({ href, children, ...props }) => (
                            <a
                              href={href}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-800 underline"
                              {...props}
                            >
                              {children}
                            </a>
                          ),
                          code: ({ className, children, ...props }) => {
                            const match = /language-(\w+)/.exec(className || '');
                            return match ? (
                              <code
                                className="block bg-slate-100 p-3 rounded text-sm font-mono overflow-x-auto"
                                {...props}
                              >
                                {children}
                              </code>
                            ) : (
                              <code
                                className="bg-slate-100 px-1.5 py-0.5 rounded text-sm font-mono"
                                {...props}
                              >
                                {children}
                              </code>
                            );
                          },
                          h1: ({ children, ...props }) => (
                            <h1 className="text-2xl font-bold mt-6 mb-4" {...props}>
                              {children}
                            </h1>
                          ),
                          h2: ({ children, ...props }) => (
                            <h2 className="text-xl font-semibold mt-5 mb-3" {...props}>
                              {children}
                            </h2>
                          ),
                          h3: ({ children, ...props }) => (
                            <h3 className="text-lg font-medium mt-4 mb-2" {...props}>
                              {children}
                            </h3>
                          ),
                          blockquote: ({ children, ...props }) => (
                            <blockquote className="border-l-4 border-slate-300 pl-4 italic text-slate-600 my-4" {...props}>
                              {children}
                            </blockquote>
                          ),
                          ul: ({ children, ...props }) => (
                            <ul className="list-disc list-inside my-4 space-y-2" {...props}>
                              {children}
                            </ul>
                          ),
                          ol: ({ children, ...props }) => (
                            <ol className="list-decimal list-inside my-4 space-y-2" {...props}>
                              {children}
                            </ol>
                          ),
                          li: ({ children, ...props }) => (
                            <li className="break-words overflow-hidden text-ellipsis max-w-full" {...props}>
                              <span className="block truncate pr-2">{children}</span>
                            </li>
                          ),
                          img: ({ src, alt, ...props }) => {
                            const { width, height, ...imageProps } = props;
                            return (
                              <Image
                                src={typeof src === 'string' ? src : ''}
                                alt={alt || ''}
                                width={800}
                                height={600}
                                className="max-w-full h-auto rounded-lg shadow-sm my-4"
                                {...imageProps}
                              />
                            );
                          },
                        }}
                      >
                        {previewContent}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <div className="text-slate-400 italic text-center py-8">
                      内容を入力するとプレビューが表示されます
                    </div>
                  )}
                </div>
              </div>
            </div>
            
            <DialogFooter className="px-4 py-3 border-t gap-2 sm:px-6 sm:py-4 flex-col-reverse sm:flex-row flex-shrink-0">
              <Button variant="outline" onClick={() => setNoteDialogOpen(false)} className="w-full sm:w-auto">
                キャンセル
              </Button>
              <Button onClick={handleSave} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-1"/> 保存
              </Button>
            </DialogFooter>
          </div>
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
            </div>
          </div>
          {activeProject && (
            <div className="hidden md:flex items-center gap-3">
              <div className="relative">
                <Input 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="検索（タイトル・本文）" 
                  className="text-sm pr-8 w-64"
                />
                {query && (
                  <button
                    onClick={() => setQuery("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-4 h-4"/>
                  </button>
                )}
              </div>
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