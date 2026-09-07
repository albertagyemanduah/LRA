import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MessageSquare, Send, Search, Trash2, ArrowLeft } from "lucide-react";
import pb from "@/lib/pocketbaseClient";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { roleLabel } from "@/lib/roles";

function UserAvatar({ name, size = "md" }) {
  const initials = (name || "U").slice(0, 2).toUpperCase();
  return (
    <span className={cn(
      "flex shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-primary",
      size === "sm" ? "h-8 w-8 text-xs" : "h-10 w-10 text-sm"
    )}>
      {initials}
    </span>
  );
}

export default function ChatPage() {
  const { userId: paramUserId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [sending, setSending] = useState(false);
  const [onlineUsers] = useState(new Set()); // placeholder
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Load all users
  useEffect(() => {
    pb.collection("users").getFullList({ sort: "fullName", requestKey: "chat-users" })
      .then((list) => setAllUsers(list.filter((u) => u.id !== user.id)))
      .catch(() => {});
  }, [user.id]);

  // Select user from URL param
  useEffect(() => {
    if (paramUserId && allUsers.length > 0) {
      const found = allUsers.find((u) => u.id === paramUserId);
      if (found) setSelectedUser(found);
    }
  }, [paramUserId, allUsers]);

  // Load messages when selectedUser changes
  useEffect(() => {
    if (!selectedUser) return;
    setMessages([]);

    const myId = user.id;
    const theirId = selectedUser.id;

    pb.collection("chat_messages").getFullList({
      filter: `(sender = "${myId}" && recipient = "${theirId}") || (sender = "${theirId}" && recipient = "${myId}")`,
      sort: "created",
      requestKey: `chat-msgs-${theirId}`,
    }).then(setMessages).catch(() => {});

    // Subscribe to new messages
    void pb.collection("chat_messages").subscribe("*", (e) => {
      const rec = e.record;
      const relevant =
        (rec.sender === myId && rec.recipient === theirId) ||
        (rec.sender === theirId && rec.recipient === myId);
      if (!relevant) return;
      if (e.action === "create") setMessages((prev) => [...prev, rec]);
      if (e.action === "delete") setMessages((prev) => prev.filter((m) => m.id !== rec.id));
    }).catch(() => {});

    return () => {
      void pb.collection("chat_messages").unsubscribe("*").catch(() => {});
    };
  }, [selectedUser, user.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedUser) return;
    setSending(true);
    const text = newMsg.trim();
    setNewMsg("");
    try {
      await pb.collection("chat_messages").create({
        sender: user.id,
        recipient: selectedUser.id,
        message: text,
        read: false,
      });
    } catch (_) {
      setNewMsg(text);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const clearHistory = async () => {
    if (!selectedUser) return;
    if (!window.confirm("Clear entire chat history with this user?")) return;
    const myMsgs = messages.filter((m) => m.sender === user.id);
    await Promise.all(myMsgs.map((m, i) =>
      pb.collection("chat_messages").delete(m.id, { requestKey: `del-${i}` }).catch(() => {})
    ));
    setMessages((prev) => prev.filter((m) => m.sender !== user.id));
  };

  const filteredUsers = allUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return !q || u.fullName?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.role?.includes(q);
  });

  const selectUser = (u) => {
    setSelectedUser(u);
    navigate(`/app/chat/${u.id}`, { replace: true });
  };

  const getLastMsg = (u) => {
    // Could be computed from messages, but for list we don't load all convos
    return null;
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Sidebar */}
      <div className={cn(
        "flex flex-col border-r border-border",
        selectedUser ? "hidden md:flex md:w-72 lg:w-80" : "w-full md:w-72 lg:w-80"
      )}>
        <div className="border-b border-border p-4">
          <h2 className="font-display text-base font-semibold mb-3">Messages</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={userSearch} onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Search users…" className="pl-9 h-9 text-sm" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredUsers.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            filteredUsers.map((u) => (
              <button key={u.id} onClick={() => selectUser(u)}
                className={cn(
                  "flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-secondary/60",
                  selectedUser?.id === u.id && "bg-primary/5 border-r-2 border-primary"
                )}>
                <div className="relative">
                  <UserAvatar name={u.fullName || u.email} size="sm" />
                  <span className={cn(
                    "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                    onlineUsers.has(u.id) ? "bg-blue-500" : "bg-muted-foreground/40"
                  )} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1">
                    <p className="truncate text-sm font-medium">{u.fullName || u.email}</p>
                    {u.whatsappNumber && <svg viewBox="0 0 24 24" className="h-3 w-3 fill-green-500 shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">{roleLabel(u.role)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat window */}
      {selectedUser ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <button onClick={() => { setSelectedUser(null); navigate("/app/chat", { replace: true }); }}
              className="mr-1 text-muted-foreground hover:text-foreground md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <UserAvatar name={selectedUser.fullName || selectedUser.email} size="sm" />
            <div className="flex-1">
              <p className="font-medium">{selectedUser.fullName || selectedUser.email}</p>
              <p className="text-xs text-muted-foreground">{roleLabel(selectedUser.role)}</p>
            </div>
            {selectedUser.whatsappNumber && (
              <a
                href={`https://wa.me/${selectedUser.whatsappNumber.replace(/\D/g, "").replace(/^0/, "233")}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Open WhatsApp chat"
                className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 transition-colors"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                WhatsApp
              </a>
            )}
            <Button variant="ghost" size="icon" onClick={clearHistory} title="Clear my messages">
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-3 opacity-20" />
                <p className="text-sm">No messages yet. Say hello!</p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.sender === user.id;
                return (
                  <div key={msg.id} className={cn("flex gap-2", isMe ? "flex-row-reverse" : "flex-row")}>
                    {!isMe && <UserAvatar name={selectedUser.fullName || selectedUser.email} size="sm" />}
                    <div className={cn(
                      "max-w-[70%] rounded-2xl px-4 py-2.5 text-sm",
                      isMe
                        ? "rounded-tr-sm bg-primary text-primary-foreground"
                        : "rounded-tl-sm bg-secondary text-foreground"
                    )}>
                      <p className="break-words">{msg.message}</p>
                      <p className={cn("mt-1 text-[10px]", isMe ? "text-primary-foreground/70 text-right" : "text-muted-foreground")}>
                        {timeAgo(msg.created)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* WhatsApp Banner */}
          {selectedUser.whatsappNumber && (
            <div className="border-t border-green-200 dark:border-green-900/40 bg-green-50 dark:bg-green-900/10 px-4 py-2 flex items-center justify-between gap-2">
              <span className="text-xs text-green-700 dark:text-green-400 flex items-center gap-1.5">
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current shrink-0" xmlns="http://www.w3.org/2000/svg"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                {selectedUser.fullName || selectedUser.email} has WhatsApp ({selectedUser.whatsappNumber})
              </span>
              <a
                href={`https://wa.me/${selectedUser.whatsappNumber.replace(/\D/g, "").replace(/^0/, "233")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded text-xs font-medium text-green-700 dark:text-green-400 underline underline-offset-2 hover:no-underline"
              >
                Open WhatsApp →
              </a>
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3">
            <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMsg}
                onChange={(e) => setNewMsg(e.target.value)}
                placeholder="Type a message…"
                className="flex-1"
                disabled={sending}
              />
              <Button type="submit" size="icon" disabled={!newMsg.trim() || sending}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center text-center text-muted-foreground md:flex">
          <MessageSquare className="h-16 w-16 mb-4 opacity-10" />
          <p className="text-base font-medium">Select a user to start chatting</p>
          <p className="text-sm mt-1 opacity-70">Choose from the list on the left</p>
        </div>
      )}
    </div>
  );
}
