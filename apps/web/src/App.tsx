import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { io, type Socket } from "socket.io-client";
import type { AccountUser, ConversationDto, MessageDto, PublicUser } from "@secure-chat/shared";
import { api } from "./api";
import { AuthForm } from "./components/AuthForm";
import { Avatar } from "./components/Avatar";
import { Navigation } from "./components/Navigation";
import { UserSearch } from "./components/UserSearch";
import { ChatList } from "./components/ChatList";
import { MessageBubble } from "./components/MessageBubble";
import { MessageComposer, TypingIndicator } from "./components/MessageComposer";
import { ProfileModal } from "./components/ProfileModal";
import { EmptyState, ErrorBanner, LoadingSpinner } from "./components/States";

function ChatApp() {
  const navigate = useNavigate();
  const [me, setMe] = useState<AccountUser>();
  const [conversations, setConversations] = useState<ConversationDto[]>([]);
  const [selected, setSelected] = useState<ConversationDto>();
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [profileOpen, setProfileOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const socketRef = useRef<Socket>();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const selectedConversationIdRef = useRef<string>();
  const conversationLoadIdRef = useRef(0);

  // Initial user profile & conversation list loading
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [profileRes, convListRes] = await Promise.all([
        api.me(),
        api.conversations()
      ]);
      setMe(profileRes.user);
      setConversations(convListRes.conversations);
    } catch {
      navigate("/login", { replace: true });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Socket.IO lifecycle and event listeners
  useEffect(() => {
    if (!me) return;

    const socket = io(api.base, {
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      const conversationId = selectedConversationIdRef.current;
      if (conversationId) {
        socket.emit("conversation:join", conversationId, (response?: { error?: string }) => {
          if (response?.error) setError(response.error);
        });
      }
    });

    // Incoming new message
    socket.on("message:new", (m: MessageDto) => {
      setConversations((prev) => {
        const updated = prev.map((c) =>
          c.id === m.conversationId
            ? { ...c, lastMessage: m, lastMessageAt: m.createdAt, updatedAt: m.createdAt }
            : c
        );
        return updated.sort((a, b) =>
          (b.lastMessageAt ?? b.updatedAt ?? "").localeCompare(a.lastMessageAt ?? a.updatedAt ?? "")
        );
      });

      if (selectedConversationIdRef.current === m.conversationId) {
        setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
        // If the other participant sent it and chat is open, acknowledge read
        if (m.senderId !== me.id) {
          socket.emit("messages:read", m.conversationId);
        }
      }
    });

    // Realtime read receipts
    socket.on("messages:read", ({ conversationId }: { conversationId: string }) => {
      if (selectedConversationIdRef.current === conversationId) {
        setMessages((prev) =>
          prev.map((msg) => (msg.senderId === me.id ? { ...msg, status: "read" } : msg))
        );
      }
    });

    // Realtime typing indicators
    socket.on("typing:update", (payload: { conversationId: string; userId: string; isTyping: boolean }) => {
      if (payload.conversationId === selectedConversationIdRef.current && payload.userId !== me.id) {
        setTyping(payload.isTyping);
      }
    });

    // Realtime presence updates
    socket.on("presence:update", (payload: { userId: string; online: boolean; lastSeen?: string }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          participants: c.participants.map((u) =>
            u.id === payload.userId ? { ...u, online: payload.online, lastSeen: payload.lastSeen } : u
          )
        }))
      );
    });

    return () => {
      socket.disconnect();
    };
  }, [me?.id]);

  // Auto-scroll messages container to bottom on new message or typing
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typing]);

  // Open a conversation and load history
  const openConversation = async (conversation: ConversationDto) => {
    const loadId = ++conversationLoadIdRef.current;
    selectedConversationIdRef.current = conversation.id;
    setSelected(conversation);
    setMessages([]);
    setTyping(false);
    setError("");

    try {
      const response = await api.messages(conversation.id);
      if (loadId !== conversationLoadIdRef.current) return;
      setMessages(response.messages);
      socketRef.current?.emit("conversation:join", conversation.id, (response?: { error?: string }) => {
        if (response?.error) setError(response.error);
      });
      socketRef.current?.emit("messages:read", conversation.id);
    } catch (err) {
      if (loadId !== conversationLoadIdRef.current) return;
      setError(err instanceof Error ? err.message : "Could not load messages");
    }
  };

  // Start or open conversation from search result
  const handleSelectSearchedUser = async (user: PublicUser) => {
    try {
      const res = await api.createConversation(user.id);
      const conv = res.conversation;
      setConversations((prev) =>
        prev.some((x) => x.id === conv.id) ? prev : [conv, ...prev]
      );
      await openConversation(conv);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open conversation");
    }
  };

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  if (loading || !me) {
    return (
      <main className="app-shell center-screen">
        <LoadingSpinner text="Connecting securely to Private Messenger…" />
      </main>
    );
  }

  const otherUser = selected?.participants.find((u) => u.id !== me.id);

  return (
    <main className="app-shell">
      {/* Sidebar: Navigation, Search, Conversation List */}
      <aside className={`sidebar ${selected ? "mobile-hidden" : ""}`}>
        <Navigation
          currentUser={me}
          onOpenProfile={() => setProfileOpen(true)}
          onLogout={handleLogout}
        />

        <div className="sidebar-section-title">
          <span>ONE-TO-ONE CHATS</span>
        </div>

        <UserSearch onSelectUser={handleSelectSearchedUser} />

        {error && <ErrorBanner message={error} onDismiss={() => setError("")} />}

        <ChatList
          conversations={conversations}
          currentUser={me}
          selectedId={selected?.id}
          onSelectConversation={openConversation}
        />
      </aside>

      {/* Main Chat Thread Area */}
      <section className={`chat-thread ${selected ? "" : "mobile-hidden empty-thread"}`}>
        {selected && otherUser ? (
          <>
            <header className="thread-header">
              <button
                type="button"
                className="btn-back-mobile"
                onClick={() => {
                  conversationLoadIdRef.current += 1;
                  selectedConversationIdRef.current = undefined;
                  setSelected(undefined);
                  setMessages([]);
                  setTyping(false);
                }}
                aria-label="Back to conversations"
              >
                ←
              </button>
              <Avatar user={otherUser} size="md" showStatus />
              <div className="thread-user-info">
                <h3>{otherUser.name}</h3>
                <span className="muted small">
                  {otherUser.online ? "Online" : "Offline"} · @{otherUser.username}
                </span>
              </div>
            </header>

            <div className="messages-viewport">
              {messages.length === 0 ? (
                <EmptyState
                  title="No messages yet"
                  description={`This is the start of your direct conversation with ${otherUser.name}.`}
                />
              ) : (
                messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMine={m.senderId === me.id}
                  />
                ))
              )}
              {typing && <TypingIndicator name={otherUser.name} />}
              <div ref={messagesEndRef} />
            </div>

            <MessageComposer
              conversationId={selected.id}
              socket={socketRef.current}
            />
          </>
        ) : (
          <EmptyState
            title="Select a conversation"
            description="Choose a conversation from the sidebar or search for a user to begin chatting."
          />
        )}
      </section>

      {/* User Profile Modal */}
      <ProfileModal
        user={me}
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
        onLogout={handleLogout}
      />
    </main>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<AuthForm isRegister={false} />} />
      <Route path="/register" element={<AuthForm isRegister={true} />} />
      <Route path="/" element={<ChatApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
