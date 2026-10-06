/**
 * Unified markdown editing layer.
 *
 * Tiptap v3 in headless mode + the official @tiptap/markdown extension, so
 * the editor loads and stores plain markdown — the same format MarkdownView
 * renders and the app persists. Content typography reuses the `.markdown-note`
 * styles (App.css), making view and edit states visually identical.
 *
 * Keyboard contract matches the TextArea it replaces:
 * - Cmd/Ctrl+Enter fires onSubmit
 * - Escape fires onCancel
 *
 * The editor is uncontrolled: it is seeded from `initialContent` on mount and
 * reports serialized markdown through `onChange`. The component remounts per
 * edit session (branch switch), so each session starts from the stored note.
 *
 * @example
 * ```tsx
 * <MarkdownEditor
 *   initialContent={note.content}
 *   onChange={setEditText}
 *   onSubmit={handleSave}
 *   onCancel={handleCancel}
 *   placeholder="Write your note..."
 * />
 * ```
 */

import { useEffect, useRef, useState } from "react";
import { matchesAction } from "@/stores/useKeyboardStore";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "@tiptap/markdown";
import { TaskItem, TaskList } from "@tiptap/extension-list";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import {
  Bold,
  Check,
  Code,
  Braces,
  Heading2,
  Heading3,
  Italic,
  Link2,
  List,
  ListOrdered,
  ListTodo,
  Quote,
  Strikethrough,
  X,
} from "lucide-react";
import { Button } from "@/components/primitives";

interface MarkdownEditorProps {
  /** Markdown source the editor is seeded with on mount */
  initialContent: string;
  /** Called with the serialized markdown after every content change */
  onChange?: (markdown: string) => void;
  /** Called on Cmd/Ctrl+Enter (save shortcut) */
  onSubmit?: () => void;
  /** Called on Escape (cancel shortcut) */
  onCancel?: () => void;
  /** Placeholder shown when the document is empty */
  placeholder?: string;
  /** Extra classes for the outer box */
  className?: string;
}

export function MarkdownEditor({
  initialContent,
  onChange,
  onSubmit,
  onCancel,
  placeholder = "Write something...",
  className = "",
}: MarkdownEditorProps) {
  // Live refs so the once-created editor always calls the latest callbacks
  // without being recreated when parents pass inline closures.
  const onChangeRef = useRef(onChange);
  const onSubmitRef = useRef(onSubmit);
  const onCancelRef = useRef(onCancel);
  useEffect(() => {
    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
    onCancelRef.current = onCancel;
  }, [onChange, onSubmit, onCancel]);

  const editor = useEditor(
    {
      content: initialContent,
      contentType: "markdown",
      // No autofocus: focusing would place the caret (at the document end)
      // and the browser would scroll the drawer's scroll container to reveal
      // it, so the drawer would open scrolled away from the top.
      autofocus: false,
      extensions: [
        StarterKit.configure({
          // Notes only use h2/h3; h1 would shout inside a drawer.
          heading: { levels: [2, 3] },
          // Don't navigate away from the editor while editing a link.
          link: { openOnClick: false },
        }),
        Markdown,
        TaskList,
        TaskItem.configure({ nested: true }),
        // GFM tables: MarkdownView renders them (remark-gfm), so the editor
        // must understand them too or a note with a table would lose it.
        TableKit.configure({ table: { resizable: false } }),
        Placeholder.configure({ placeholder }),
      ],
      editorProps: {
        attributes: {
          class:
            "markdown-note text-sm text-text dark:text-text-dark leading-relaxed break-words px-3 py-2 min-h-40 w-full outline-none",
        },
        handleKeyDown: (_view, event) => {
          if (onSubmitRef.current && matchesAction("submit", event)) {
            onSubmitRef.current?.();
            return true;
          }
          if (event.key === "Escape") {
            onCancelRef.current?.();
            return true;
          }
          return false;
        },
      },
      onUpdate: ({ editor }) => {
        onChangeRef.current?.(editor.getMarkdown());
      },
    },
    [],
  );

  return (
    <div
      className={`markdown-editor rounded-md border border-border dark:border-border-dark bg-surface dark:bg-surface-dark overflow-hidden ${className}`}
    >
      {editor && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Toolbar
// ---------------------------------------------------------------------------

function ToolButton({
  active,
  title,
  onClick,
  children,
}: {
  active?: boolean;
  title: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      variant="icon"
      title={title}
      // Prevent the mousedown from stealing focus from the editor, so
      // toggle commands apply to the current selection.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={
        active
          ? "text-accent dark:text-accent-dark bg-accent/10"
          : "text-text-secondary dark:text-text-secondary-dark"
      }
    >
      {children}
    </Button>
  );
}

function EditorToolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor }) => ({
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      strike: editor.isActive("strike"),
      h2: editor.isActive("heading", { level: 2 }),
      h3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      taskList: editor.isActive("taskList"),
      blockquote: editor.isActive("blockquote"),
      code: editor.isActive("code"),
      codeBlock: editor.isActive("codeBlock"),
      link: editor.isActive("link"),
    }),
  });

  const [linkEditing, setLinkEditing] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");

  const applyLink = () => {
    const url = linkUrl.trim();
    if (url) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    } else {
      editor.chain().focus().unsetLink().run();
    }
    setLinkEditing(false);
    setLinkUrl("");
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-border dark:border-border-dark">
      <ToolButton
        active={state.bold}
        title="Bold"
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        <Bold size={15} />
      </ToolButton>
      <ToolButton
        active={state.italic}
        title="Italic"
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <Italic size={15} />
      </ToolButton>
      <ToolButton
        active={state.strike}
        title="Strikethrough"
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <Strikethrough size={15} />
      </ToolButton>
      <ToolButton
        active={state.code}
        title="Inline code"
        onClick={() => editor.chain().focus().toggleCode().run()}
      >
        <Code size={15} />
      </ToolButton>

      <div className="w-px h-4 bg-border dark:bg-border-dark mx-1" />

      <ToolButton
        active={state.h2}
        title="Heading 2"
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        <Heading2 size={15} />
      </ToolButton>
      <ToolButton
        active={state.h3}
        title="Heading 3"
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        <Heading3 size={15} />
      </ToolButton>

      <div className="w-px h-4 bg-border dark:bg-border-dark mx-1" />

      <ToolButton
        active={state.bulletList}
        title="Bullet list"
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <List size={15} />
      </ToolButton>
      <ToolButton
        active={state.orderedList}
        title="Numbered list"
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <ListOrdered size={15} />
      </ToolButton>
      <ToolButton
        active={state.taskList}
        title="Task list"
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <ListTodo size={15} />
      </ToolButton>
      <ToolButton
        active={state.blockquote}
        title="Quote"
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <Quote size={15} />
      </ToolButton>
      <ToolButton
        active={state.codeBlock}
        title="Code block"
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <Braces size={15} />
      </ToolButton>

      <div className="w-px h-4 bg-border dark:bg-border-dark mx-1" />

      {linkEditing ? (
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                applyLink();
              }
              if (e.key === "Escape") {
                setLinkEditing(false);
                setLinkUrl("");
              }
            }}
            placeholder="https://..."
            autoFocus
            className="min-w-0 flex-1 px-2 py-1 text-xs font-sans text-text dark:text-text-dark bg-bg dark:bg-bg-dark border border-border dark:border-border-dark rounded outline-none focus:border-accent dark:focus:border-accent-dark"
          />
          <Button variant="icon" title="Apply link" onClick={applyLink}>
            <Check size={15} />
          </Button>
          <Button
            variant="icon"
            title="Cancel"
            onClick={() => {
              setLinkEditing(false);
              setLinkUrl("");
            }}
          >
            <X size={15} />
          </Button>
        </div>
      ) : (
        <ToolButton
          active={state.link}
          title="Link"
          onClick={() => {
            setLinkUrl(editor.getAttributes("link").href ?? "");
            setLinkEditing(true);
          }}
        >
          <Link2 size={15} />
        </ToolButton>
      )}
    </div>
  );
}
