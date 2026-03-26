/**
 * ChatPanel - embedded chat thread for a requisition or purchase order.
 * Supplier <-> Procurement on POs, Pharmacist <-> Procurement on Requisitions.
 */
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Pencil, Reply, Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { toast } from "sonner";

const ROLE_COLOR: Record<string, string> = {
  pharmacist: "bg-blue-100 text-blue-800",
  procurement_officer: "bg-orange-100 text-orange-800",
  supplier: "bg-teal-100 text-teal-800",
  accountant: "bg-purple-100 text-purple-800",
  admin: "bg-gray-100 text-gray-700",
};

const ROLE_LABEL: Record<string, string> = {
  pharmacist: "Pharmacist",
  procurement_officer: "Procurement",
  supplier: "Supplier",
  accountant: "Accountant",
  admin: "Admin",
};

interface Props {
  entityType: "requisition" | "purchase_order";
  entityId: number;
  entityLabel?: string;
}

function excerpt(message: string, max = 90) {
  return message.length > max ? `${message.slice(0, max)}...` : message;
}

export default function ChatPanel({ entityType, entityId, entityLabel }: Props) {
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [replyingTo, setReplyingTo] = useState<any | null>(null);
  const [editingMessage, setEditingMessage] = useState<any | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading, refetch } = trpc.chat.list.useQuery(
    { entityType, entityId },
    { refetchInterval: 8000 }
  );

  const send = trpc.chat.send.useMutation({
    onSuccess: () => {
      setText("");
      setReplyingTo(null);
      refetch();
    },
    onError: e => toast.error(e.message),
  });

  const edit = trpc.chat.edit.useMutation({
    onSuccess: () => {
      setText("");
      setEditingMessage(null);
      refetch();
      toast.success("Message updated");
    },
    onError: e => toast.error(e.message),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const clearComposerMode = () => {
    setReplyingTo(null);
    setEditingMessage(null);
    setText("");
  };

  const startReply = (msg: any) => {
    setEditingMessage(null);
    setReplyingTo(msg);
  };

  const startEdit = (msg: any) => {
    setReplyingTo(null);
    setEditingMessage(msg);
    setText(msg.message);
  };

  const handleSubmit = () => {
    const message = text.trim();
    if (!message) return;

    if (editingMessage) {
      edit.mutate({ messageId: editingMessage.id, message });
      return;
    }

    send.mutate({
      entityType,
      entityId,
      message,
      replyToMessageId: replyingTo?.id,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-lg border bg-background">
      <div className="flex items-center gap-2 border-b bg-muted/30 px-4 py-2.5 shrink-0">
        <MessageSquare className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-medium">
          {entityLabel ? `Chat - ${entityLabel}` : entityType === "purchase_order" ? "PO Discussion" : "Requisition Chat"}
        </p>
        <span className="ml-auto text-xs text-muted-foreground">{(messages as any[]).length} messages</span>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0" style={{ maxHeight: 340 }}>
        {isLoading && (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}

        {!isLoading && (messages as any[]).length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 w-8 h-8 opacity-30" />
            No messages yet - start the conversation
          </div>
        )}

        {(messages as any[]).map((msg: any) => {
          const isMe = msg.userId === user?.id;
          return (
            <div key={msg.id} className={`flex flex-col gap-1 ${isMe ? "items-end" : "items-start"}`}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {!isMe && <span className="font-medium text-foreground">{msg.userName}</span>}
                <span className={`rounded px-1.5 py-0.5 text-xs ${ROLE_COLOR[msg.userRole] || "bg-gray-100 text-gray-700"}`}>
                  {ROLE_LABEL[msg.userRole] || msg.userRole}
                </span>
                {isMe && <span className="font-medium text-foreground">You</span>}
                <span>{new Date(msg.createdAt).toLocaleTimeString("en-RW", { hour: "2-digit", minute: "2-digit" })}</span>
                {msg.isEdited && <span className="italic">edited</span>}
              </div>

              <div
                className={`max-w-xs rounded-2xl px-3 py-2 text-sm leading-relaxed md:max-w-md ${
                  isMe ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm"
                }`}
              >
                {msg.replyToMessage && (
                  <div className={`mb-2 rounded-xl border-l-2 px-2 py-1 text-xs ${
                    isMe ? "border-primary-foreground/60 bg-primary-foreground/15" : "border-primary/50 bg-background/60"
                  }`}>
                    <div className="font-medium">{msg.replyToMessage.userName}</div>
                    <div className="opacity-80">{excerpt(msg.replyToMessage.message, 70)}</div>
                  </div>
                )}
                <div className="whitespace-pre-wrap break-words">{msg.message}</div>
              </div>

              <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
                <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => startReply(msg)}>
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
                {isMe && (
                  <button className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => startEdit(msg)}>
                    <Pencil className="w-3 h-3" />
                    Edit
                  </button>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      <div className="border-t p-3 shrink-0">
        {(replyingTo || editingMessage) && (
          <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border bg-muted/40 px-3 py-2 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground">
                {editingMessage ? "Editing message" : `Replying to ${replyingTo?.userName || "message"}`}
              </p>
              <p className="truncate text-muted-foreground">
                {editingMessage ? excerpt(editingMessage.message) : excerpt(replyingTo?.message || "")}
              </p>
            </div>
            <button className="text-muted-foreground hover:text-foreground" onClick={clearComposerMode}>
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        <div className="flex gap-2">
          <Textarea
            className="h-9 min-h-0 flex-1 resize-none rounded-full px-4 py-1.5 text-sm"
            placeholder={editingMessage ? "Edit your message..." : "Type a message... (Ctrl+Enter to send)"}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
          />
          {(replyingTo || editingMessage) && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 shrink-0 rounded-full"
              onClick={clearComposerMode}
            >
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            className="h-9 w-9 shrink-0 rounded-full p-0"
            disabled={!text.trim() || send.isPending || edit.isPending}
            onClick={handleSubmit}
          >
            {send.isPending || edit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
