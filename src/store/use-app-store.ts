import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";

export type ChatRole = "user" | "assistant";
export type ChatMessage = { id: string; role: ChatRole; content: string };

export type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  updatedAt: number;
};

type AppState = {
  isLoggedIn: boolean;
  conversations: Conversation[];
  activeConversationId: string | null;
  deepThinking: boolean;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  startNewChat: () => void;
  setActiveConversation: (id: string | null) => void;
  setDeepThinking: (value: boolean) => void;
  addOrCreateUserMessage: (activeId: string | null, content: string) => string;
  addAssistantMessage: (conversationId: string, content: string) => void;
  deleteConversation: (id: string) => void;
  getActiveConversation: () => Conversation | undefined;
};

function makeTitle(text: string): string {
  const t = text.trim();
  if (!t) return "新对话";
  return t.length > 28 ? `${t.slice(0, 28)}…` : t;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      isLoggedIn: false,
      conversations: [],
      activeConversationId: null,
      deepThinking: false,

      login: (username, password) => {
        if (username === "admin" && password === "admin123") {
          set({ isLoggedIn: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ isLoggedIn: false });
      },

      startNewChat: () => {
        set({ activeConversationId: null });
      },

      setActiveConversation: (id) => {
        set({ activeConversationId: id });
      },

      setDeepThinking: (value) => set({ deepThinking: value }),

      addOrCreateUserMessage: (activeId, content) => {
        const userMsg: ChatMessage = { id: uuidv4(), role: "user", content };
        if (!activeId) {
          const id = uuidv4();
          const title = makeTitle(content);
          set((s) => ({
            conversations: [
              { id, title, messages: [userMsg], updatedAt: Date.now() },
              ...s.conversations,
            ],
            activeConversationId: id,
          }));
          return id;
        }
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === activeId
              ? { ...c, messages: [...c.messages, userMsg], updatedAt: Date.now() }
              : c,
          ),
        }));
        return activeId;
      },

      addAssistantMessage: (conversationId, content) => {
        const assistantMsg: ChatMessage = {
          id: uuidv4(),
          role: "assistant",
          content,
        };
        set((s) => ({
          conversations: s.conversations.map((c) =>
            c.id === conversationId
              ? { ...c, messages: [...c.messages, assistantMsg], updatedAt: Date.now() }
              : c,
          ),
        }));
      },

      deleteConversation: (id) => {
        set((s) => {
          const next = s.conversations.filter((c) => c.id !== id);
          const active =
            s.activeConversationId === id ? null : s.activeConversationId;
          return { conversations: next, activeConversationId: active };
        });
      },

      getActiveConversation: () => {
        const { activeConversationId, conversations } = get();
        if (!activeConversationId) return undefined;
        return conversations.find((c) => c.id === activeConversationId);
      },
    }),
    {
      name: "ai-xiaoboshi-storage",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isLoggedIn: state.isLoggedIn,
        conversations: state.conversations,
        activeConversationId: state.activeConversationId,
        deepThinking: state.deepThinking,
      }),
    },
  ),
);
