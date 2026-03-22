export function NotesPreview({ text }: { text: string }) {
  if (!text.trim()) return null;

  return <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{text}</p>;
}
