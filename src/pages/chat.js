"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";
import CallModal from "@/components/call/CallModal";
import Sidebar from "@/components/chat/Sidebar";
import ChatHeader from "@/components/chat/ChatHeader";
import MessageList from "@/components/chat/MessageList";
import MessageInput from "@/components/chat/MessageInput";
import TranslationModal from "@/components/chat/TranslationModal";
import DeleteConfirmationModal from "@/components/chat/DeleteConfirmationModal";
import { useFileUpload } from "@/hooks/useFileUpload";
import { useTranslation } from "@/hooks/useTranslation";

export default function ChatPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [archivedConversations, setArchivedConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isLoadingMessages, setIsLoadingMessages] = useState(false);
    const [newMsg, setNewMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [dark, setDark] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [selectedMessageForTranslation, setSelectedMessageForTranslation] = useState(null);
    const [selectedMessageForDeletion, setSelectedMessageForDeletion] = useState(null);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [isTranslatingMessage, setIsTranslatingMessage] = useState(false);
    const [incomingCall, setIncomingCall] = useState(null);
    const [showCallModal, setShowCallModal] = useState(false);
    const [isOutgoingCall, setIsOutgoingCall] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [showSidebar, setShowSidebar] = useState(true);
    const [isAILoading, setIsAILoading] = useState(false);
    const [aiConversationId, setAiConversationId] = useState(null);

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const pusherRef = useRef(null);
    const presenceRef = useRef(null);
    const conversationChannelsRef = useRef({});
    const selectedConvRef = useRef(null);
    const conversationsRef = useRef([]);
    const userRef = useRef(null);
    
    // Client-side cache for messages and conversations
    const messagesCacheRef = useRef(new Map()); // conversationId -> { messages, timestamp }
    const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    // Custom hooks
    const {
        recvLang,
        setRecvLang,
        recvLangRef,
        translateCacheRef
    } = useTranslation(selectedConv, messages, setMessages);

    const {
        isUploading,
        selectedFile,
        fileInputRef,
        handleFileSelect,
        removeSelectedFile,
        formatFileSize,
        setSelectedFile
    } = useFileUpload();

    // Note: messagesEndRef and messagesContainerRef are defined above, not from hook

    // Load dark mode preference
    useEffect(() => {
        const storedDark = localStorage.getItem("darkMode");
        if (storedDark) setDark(JSON.parse(storedDark));
    }, []);

    const toggleDark = () => {
        setDark((prev) => {
            localStorage.setItem("darkMode", !prev);
            return !prev;
        });
    };

    // Load user and conversations
    useEffect(() => {
        const stored = localStorage.getItem("user");
        if (!stored) {
            router.push("/");
        } else {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            const load = async () => {
                setIsLoadingChats(true);
                try {
                    // Check cache first
                    const cacheKey = `conversations-${parsed.id}`;
                    const cached = sessionStorage.getItem(cacheKey);
                    const now = Date.now();
                    
                    if (cached) {
                        try {
                            const { data, timestamp } = JSON.parse(cached);
                            if (now - timestamp < CACHE_TTL) {
                                // Use cached data
                                const regularList = data.regular || [];
                                const archivedList = data.archived || [];
                                setConversations(Array.from(new Map(regularList.map((c) => [c._id, c])).values()));
                                setArchivedConversations(Array.from(new Map(archivedList.map((c) => [c._id, c])).values()));
                                setIsLoadingChats(false);
                                
                                // Load fresh data in background
                                Promise.all([
                                    axios.get(`/api/conversations?userId=${parsed.id}`),
                                    axios.get(`/api/conversations?userId=${parsed.id}&includeArchived=true`).catch(() => ({ data: [] }))
                                ]).then(([regularRes, archivedRes]) => {
                                    const regularList = Array.isArray(regularRes.data) ? regularRes.data : [];
                                    const archivedList = Array.isArray(archivedRes.data) ? archivedRes.data : [];
                                    setConversations(Array.from(new Map(regularList.map((c) => [c._id, c])).values()));
                                    setArchivedConversations(Array.from(new Map(archivedList.map((c) => [c._id, c])).values()));
                                    // Update cache
                                    sessionStorage.setItem(cacheKey, JSON.stringify({
                                        data: { regular: regularList, archived: archivedList },
                                        timestamp: now
                                    }));
                                });
                                return;
                            }
                        } catch (e) {
                            // Cache invalid, continue to fetch
                        }
                    }
                    
                    // Fetch fresh data
                    const [regularRes, archivedRes] = await Promise.all([
                        axios.get(`/api/conversations?userId=${parsed.id}`),
                        axios.get(`/api/conversations?userId=${parsed.id}&includeArchived=true`).catch(() => ({ data: [] }))
                    ]);
                    const regularList = Array.isArray(regularRes.data) ? regularRes.data : [];
                    const archivedList = Array.isArray(archivedRes.data) ? archivedRes.data : [];
                    setConversations(Array.from(new Map(regularList.map((c) => [c._id, c])).values()));
                    setArchivedConversations(Array.from(new Map(archivedList.map((c) => [c._id, c])).values()));
                    
                    // Cache the result
                    sessionStorage.setItem(cacheKey, JSON.stringify({
                        data: { regular: regularList, archived: archivedList },
                        timestamp: now
                    }));
                } finally {
                    setIsLoadingChats(false);
                }
            };
            load();
        }
    }, [router]);

    // Search users (debounced)
    useEffect(() => {
        if (!user) return;
        const q = searchQuery.trim();
        if (q.length === 0) {
            setSearchResults([]);
            return;
        }
        setIsSearching(true);
        const id = setTimeout(async () => {
            try {
                const res = await axios.get(`/api/users/search?q=${encodeURIComponent(q)}&userId=${user?.id}`);
                setSearchResults(res?.data || []);
            } catch (_) {
                setSearchResults([]);
            } finally {
                setIsSearching(false);
            }
        }, 300);
        return () => clearTimeout(id);
    }, [searchQuery, user]);

    // Subscribe to global presence channel
    useEffect(() => {
        if (!user) return;

        if (presenceRef.current) {
            try {
                presenceRef.current.unbind_all();
                const oldName = presenceRef.current.name;
                pusherRef.current?.unsubscribe(oldName);
            } catch (e) {}
            presenceRef.current = null;
        }
        if (pusherRef.current) {
            try {
                pusherRef.current.disconnect();
            } catch (e) {}
            pusherRef.current = null;
        }

        setOnlineUsers([]);

        pusherRef.current = pusherClient(user);
        const pusher = pusherRef.current;

        pusher.connection.bind('connecting', () => {});

        pusher.connection.bind('connected', () => {
            setupPresenceChannel();
        });

        pusher.connection.bind('disconnected', () => {});

        pusher.connection.bind('error', (error) => {});

        if (pusher.connection.state === 'connected') {
            setupPresenceChannel();
        }

        function setupPresenceChannel() {
            if (presenceRef.current) {
                return;
            }

            presenceRef.current = pusher.subscribe("presence-online-users");
            const presenceChannel = presenceRef.current;

            presenceChannel.bind("pusher:subscription_succeeded", (members) => {
                const online = [];
                members.each((member) => {
                    let userId = member?.id || member?.user_id || member?.userId;
                    let userName = member?.info?.name || member?.name || 'Unknown';
                    if (userId && user?.id && userId !== user.id) {
                        online.push({ id: userId, name: userName });
                    }
                });
                setOnlineUsers(online);
            });

            presenceChannel.bind("pusher:subscription_error", (error) => {});

            presenceChannel.bind("pusher:member_added", (member) => {
                let userId = member?.id || member?.user_id || member?.userId;
                let userName = member?.info?.name || member?.name || 'Unknown';
                if (userId && user?.id && userId !== user.id) {
                    setOnlineUsers((prev) => [...prev, { id: userId, name: userName }]);
                }
            });

            presenceChannel.bind("pusher:member_removed", (member) => {
                setOnlineUsers((prev) => {
                    const filtered = prev.filter((u) => u?.id !== member?.id);
                    return filtered;
                });
            });
        }
    }, [user]);

    // Ensure we disconnect on tab close/refresh
    useEffect(() => {
        const handleBeforeUnload = () => {
            try {
                presenceRef.current?.unbind_all();
                if (presenceRef.current) {
                    pusherRef.current?.unsubscribe(presenceRef.current.name);
                }
                pusherRef.current?.disconnect();
            } catch (e) {}
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    // Keep refs in sync
    useEffect(() => {
        conversationsRef.current = conversations;
    }, [conversations]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // Subscribe to conversation channels
    useEffect(() => {
        const currentUser = userRef.current;
        const currentConversations = conversationsRef.current;
        if (!currentUser) return;
        if (!pusherRef.current) return;
        if (!Array.isArray(currentConversations)) return;

        const waitForPusherConnection = () => {
            if (pusherRef.current.connection.state === 'connected') {
                setupConversationChannels();
            } else {
                setTimeout(waitForPusherConnection, 100);
            }
        };

        waitForPusherConnection();

        function setupConversationChannels() {
            const pusher = pusherRef.current;
            const existing = conversationChannelsRef.current;
            const currentConversations = conversationsRef.current;
            const currentUser = userRef.current;
            const activeIds = new Set(currentConversations.map((c) => c._id));

            Object.keys(existing).forEach((convId) => {
                if (!activeIds.has(convId)) {
                    try {
                        if (existing[convId].channel) {
                            existing[convId].channel.unbind_all();
                            pusher.unsubscribe(existing[convId].channel.name);
                        }
                        if (existing[convId].presenceChannel) {
                            existing[convId].presenceChannel.unbind_all();
                            pusher.unsubscribe(existing[convId].presenceChannel.name);
                        }
                    } catch (_) {}
                    delete existing[convId];
                }
            });

            currentConversations.forEach((conv) => {
                const convId = conv._id;
                if (existing[convId]) return;

                const channel = pusher.subscribe(`conversation-${convId}`);
                const presenceChannel = pusher.subscribe(`presence-conversation-${convId}`);

                channel.bind('pusher:subscription_succeeded', () => {});

                channel.bind('pusher:subscription_error', (error) => {});

                presenceChannel.bind('pusher:subscription_succeeded', () => {});

                presenceChannel.bind('pusher:subscription_error', (error) => {});

                presenceChannel.bind("call:offer", (payload) => {
                    if (String(payload.from?.id) === String(currentUser.id)) {
                        return;
                    }
                    setIncomingCall(payload);
                    setShowCallModal(true);
                });

                channel.bind("new-message", (msg) => {
                    const messageConvId = (msg.conversation?._id || msg.conversation);
                    if (messageConvId !== convId) return;
                    const isFromMe = (msg.sender?._id || msg.sender) === currentUser.id;
                    // Use ref to get current selectedConv value to avoid stale closure
                    const isActive = selectedConvRef.current === convId;
                    setConversations((prev) =>
                        prev.map((c) => {
                            if (c._id !== convId) return c;
                            return {
                                ...c,
                                lastMessage: msg,
                                unreadCount: isFromMe || isActive ? 0 : (c.unreadCount || 0) + 1,
                            };
                        })
                    );
                });

                channel.bind("messages-seen", ({ userId }) => {
                    if (userId === currentUser.id) {
                        setConversations((prev) =>
                            prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
                        );
                    }
                });

                existing[convId] = { channel, presenceChannel };
            });
        }

        return () => {
            // Cleanup function
        };
    }, [conversations.length, user?.id || null]);

    // Subscribe to per-user events
    useEffect(() => {
        if (!user) return;
        if (!pusherRef.current) return;

        const pusher = pusherRef.current;
        const channel = pusher.subscribe(`user-${user?.id}`);

        const handleUpsert = async ({ conversationId }) => {
            try {
                const res = await axios.get(`/api/conversations?userId=${user?.id}`);
                const newList = Array.isArray(res?.data) ? res.data : [];
                const newMap = new Map(newList.map((c) => [c?._id, c]).filter(([id]) => id));
                setConversations(Array.from(newMap.values()));
            } catch (_) {}
        };

        channel.bind("conversation-upsert", handleUpsert);

        return () => {
            try { channel?.unbind("conversation-upsert", handleUpsert); } catch (_) {}
            try { pusher?.unsubscribe(`user-${user?.id}`); } catch (_) {}
        };
    }, [user]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    // Responsive handling for mobile/tablet: show either list or chat
    useEffect(() => {
        const handleResize = () => {
            const mobile = typeof window !== "undefined" ? window.innerWidth < 1024 : false;
            setIsMobile(mobile);
            if (!mobile) {
                setShowSidebar(true);
            } else {
                const hasSelection = !!selectedConvRef.current;
                setShowSidebar(hasSelection ? false : true);
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []); // rely on ref to avoid stale closure

    const loadMessages = async (convId, skip = 0) => {
        // Handle AI chat
        if (convId === "ai-chat") {
            setIsLoadingMessages(true);
            try {
                // Try to find existing AI conversation
                const res = await axios.get(`/api/conversations?userId=${user?.id}`);
                const allConvs = res?.data || [];
                const aiConv = allConvs.find(c => {
                    const otherUser = c?.participants?.find(p => {
                        const userId = p?._id || p;
                        const userEmail = p?.email;
                        return userEmail === "ai@assistant.com" || userId === "ai-assistant";
                    });
                    return otherUser !== undefined;
                });
                
                if (aiConv) {
                    setAiConversationId(aiConv?._id);
                    // Use pagination for AI messages too
                    const messagesRes = await axios.get(`/api/messages/${aiConv?._id}?limit=50&skip=${skip}&sort=desc`);
                    if (skip === 0) {
                        setMessages(messagesRes?.data?.messages || messagesRes?.data || []);
                    } else {
                        setMessages((prev) => [...(messagesRes?.data?.messages || messagesRes?.data || []), ...prev]);
                    }
                } else {
                    setMessages([]);
                    setAiConversationId(null);
                }
                // Use requestAnimationFrame for smoother scrolling
                requestAnimationFrame(() => scrollToBottom());
            } catch (error) {
                console.error("Error loading AI messages:", error);
                setMessages([]);
            } finally {
                setIsLoadingMessages(false);
            }
            return;
        }

        setIsLoadingMessages(true);
        try {
            // Check cache first (only for initial load)
            if (skip === 0) {
                const cached = messagesCacheRef.current.get(convId);
                const now = Date.now();
                if (cached && (now - cached.timestamp < CACHE_TTL)) {
                    setMessages(cached.messages);
                    setIsLoadingMessages(false);
                    // Use requestAnimationFrame for smoother scrolling
                requestAnimationFrame(() => scrollToBottom());
                    // Load fresh data in background
                    axios.get(`/api/messages/${convId}?limit=50&skip=0&sort=desc`).then((res) => {
                        const newMessages = res?.data?.messages || res?.data || [];
                        setMessages(newMessages);
                        messagesCacheRef.current.set(convId, {
                            messages: newMessages,
                            timestamp: now
                        });
                    }).catch(() => {});
                    return;
                }
            }
            
            // Use pagination - load last 50 messages initially
            const res = await axios.get(`/api/messages/${convId}?limit=50&skip=${skip}&sort=desc`);
            const newMessages = res?.data?.messages || res?.data || [];
            const pagination = res?.data?.pagination;
            
            
            if (skip === 0) {
                setMessages(newMessages);
                // Cache the result
                messagesCacheRef.current.set(convId, {
                    messages: newMessages,
                    timestamp: Date.now()
                });
            } else {
                // Prepend older messages when loading more
                setMessages((prev) => [...newMessages, ...prev]);
            }
            
            setTimeout(() => scrollToBottom(), 0);
            setConversations((prev) => prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c)));
        } finally {
            setIsLoadingMessages(false);
        }

        const pusher = pusherClient(user);
        const channel = pusher.subscribe(`conversation-${convId}`);
        const presenceChannel = pusher.subscribe(`presence-conversation-${convId}`);

        presenceChannel.bind("pusher:subscription_succeeded", () => {
        });

        presenceChannel.bind("pusher:subscription_error", (error) => {
        });

        channel.bind("new-message", async (data) => {
            let enriched = data;
            const currentTarget = recvLangRef.current;

            const hasTextContent = data.text && typeof data.text === 'string' && data.text.trim().length > 0;
            const needsTranslate = currentTarget && currentTarget !== (data.lang || "") && hasTextContent;
            if (needsTranslate) {
                try {
                    const key = `${data._id}:${currentTarget}`;
                    const cache = translateCacheRef.current;
                    if (cache.has(key)) {
                        enriched = { ...data, translatedText: cache.get(key) };
                    } else {
                        const resp = await axios.post('/api/translate', { q: data.text, source: data.lang || 'auto', target: currentTarget });
                        const text = resp.data?.translatedText || data.text;
                        cache.set(key, text);
                        enriched = { ...data, translatedText: text };
                    }
                } catch (_) {
                    enriched = { ...data, translatedText: data.text };
                }
            }
            setMessages((prev) => [...prev, enriched]);
            
            // Mark message as seen immediately since user is viewing this conversation
            const isFromMe = (data?.sender?._id || data?.sender) === user?.id;
            if (!isFromMe) {
                try {
                    await axios.put(`/api/messages/${convId}`, { userId: user.id });
                    // Update unread count to 0 for this conversation
                    setConversations((prev) =>
                        prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
                    );
                } catch (_) {
                    // Silently fail if marking as seen fails
                }
            }
        });

        channel.bind("messages-seen", ({ userId }) =>
            setMessages((prev) =>
                prev.map((msg) =>
                    msg.seenBy?.includes(userId)
                        ? msg
                        : { ...msg, seenBy: [...(msg.seenBy || []), userId] }
                )
            )
        );

        channel.bind("message-deleted", ({ messageId }) => {
            setMessages((prev) => prev.filter((msg) => msg._id !== messageId));
        });

        channel.bind("message-reaction-added", ({ messageId, reaction }) => {
            setMessages((prev) =>
                prev.map((msg) => {
                    if (msg._id === messageId) {
                        const updatedReactions = [...(msg.reactions || []), reaction];
                        return { ...msg, reactions: updatedReactions };
                    }
                    return msg;
                })
            );
        });

        channel.bind("message-reaction-removed", ({ messageId, emoji, userId }) => {
            setMessages((prev) =>
                prev.map((msg) => {
                    if (msg._id === messageId) {
                        const updatedReactions = (msg.reactions || []).filter(
                            (r) => !(r.emoji === emoji && (r.userId?._id || r.userId) === userId)
                        );
                        return { ...msg, reactions: updatedReactions };
                    }
                    return msg;
                })
            );
        });

        channel.bind("typing", ({ userId, name }) => {
            if (userId !== user.id) {
                setTypingUsers((prev) => (prev.includes(name) ? prev : [...prev, name]));
                setTimeout(() => {
                    setTypingUsers((prev) => prev.filter((n) => n !== name));
                }, 1500);
            }
        });

        presenceChannel.bind("call:offer", (payload) => {
            if (String(payload.from?.id) === String(user.id)) {
                return;
            }
            setIncomingCall(payload);
            setShowCallModal(true);
        });

        await axios.put(`/api/messages/${convId}`, { userId: user.id });
    };

    const sendMessage = async () => {
        if (!newMsg.trim() && !selectedFile) return;
        if (!selectedConv || !user) return;

        // Handle AI chat with streaming
        if (selectedConv === "ai-chat") {
            if (!newMsg.trim()) return; // AI chat doesn't support files yet
            
            setIsAILoading(true);
            const userMessageText = newMsg.trim();
            setNewMsg(""); // Clear input immediately
            
            try {
                // Add user message optimistically
                const tempUserMessage = {
                    _id: `temp-user-${Date.now()}`,
                    text: userMessageText,
                    sender: { _id: user.id, name: user.name, email: user.email },
                    conversation: aiConversationId || "ai-chat",
                    createdAt: new Date(),
                    seenBy: [user.id],
                };
                setMessages((prev) => [...prev, tempUserMessage]);
                scrollToBottom();

                // Create temp AI message for streaming
                const tempAiMessageId = `temp-ai-${Date.now()}`;
                const tempAiMessage = {
                    _id: tempAiMessageId,
                    text: "",
                    sender: { _id: "ai-assistant", name: "AI Assistant", email: "ai@assistant.com" },
                    conversation: aiConversationId || "ai-chat",
                    createdAt: new Date(),
                    seenBy: [user.id],
                    isStreaming: true,
                };
                setMessages((prev) => [...prev, tempAiMessage]);

                // Use streaming API
                const response = await fetch('/api/ai/chat-stream', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        conversationId: aiConversationId || "ai-chat",
                        message: userMessageText,
                        userId: user.id,
                    }),
                });

                if (!response.ok) {
                    throw new Error('Streaming failed');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let buffer = '';
                let fullResponse = '';

                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                
                                if (data.type === 'user-message') {
                                    // Replace temp user message with real one
                                    setMessages((prev) => {
                                        const filtered = prev.filter(m => m._id !== tempUserMessage._id);
                                        return [...filtered, data.message];
                                    });
                                } else if (data.type === 'chunk') {
                                    // Update streaming message
                                    fullResponse += data.content;
                                    setMessages((prev) =>
                                        prev.map((m) =>
                                            m._id === tempAiMessageId
                                                ? { ...m, text: fullResponse }
                                                : m
                                        )
                                    );
                                    scrollToBottom();
                                } else if (data.type === 'complete') {
                                    // Replace temp AI message with real one
                                    setMessages((prev) => {
                                        const filtered = prev.filter(m => m._id !== tempAiMessageId);
                                        return [...filtered, data.message];
                                    });
                                    
                                    // Update conversation ID if it was created
                                    if (data.message?.conversation) {
                                        setAiConversationId(data.message.conversation);
                                    }
                                    
                                    // Reload conversations to show AI chat in list
                                    try {
                                        const convs = await axios.get(`/api/conversations?userId=${user?.id}`);
                                        setConversations(convs?.data || []);
                                    } catch (_) {}
                                } else if (data.type === 'error') {
                                    throw new Error(data.error || 'AI error');
                                }
                            } catch (e) {
                                console.error('Error parsing SSE:', e);
                            }
                        }
                    }
                }

                setTimeout(() => scrollToBottom(), 100);
            } catch (error) {
                console.error("AI chat error:", error);
                // Remove temp messages on error
                setMessages((prev) => prev.filter(m => !m._id?.startsWith('temp-')));
                alert("Failed to send message to AI. Please try again.");
            } finally {
                setIsAILoading(false);
            }
            return;
        }

        // Regular message sending
        try {
            const messageData = {
                senderId: user.id,
                lang: null,
            };

            if (newMsg.trim()) {
                messageData.text = newMsg.trim();
            }

            if (selectedFile) {
                messageData.fileType = selectedFile.fileType;
                messageData.fileUrl = selectedFile.fileUrl;
                messageData.fileName = selectedFile.fileName;
                messageData.fileSize = selectedFile.fileSize;
            }

            await axios.post(`/api/messages/${selectedConv}`, messageData);
            setNewMsg("");
            setSelectedFile(null);
        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message. Please try again.");
        }
    };

    // Handle voice message
    const handleVoiceMessage = async (audioBlob) => {
        if (!selectedConv || !user || selectedConv === "ai-chat") return;

        try {
            const fileName = `voice-${Date.now()}.webm`;
            const voiceFile = new File([audioBlob], fileName, { type: 'audio/webm' });

            let fileUrl;
            let fileSize = audioBlob.size;

            // Try client-side Cloudinary upload first (bypasses Vercel timeout)
            try {
                const { uploadToCloudinary } = await import("@/utils/cloudinaryUpload");
                const uploadResult = await uploadToCloudinary(voiceFile, 'voice');
                fileUrl = uploadResult?.fileUrl;
                fileSize = uploadResult?.bytes || audioBlob.size;
            } catch (cloudinaryError) {
                console.warn('Client-side Cloudinary upload failed, trying server-side:', cloudinaryError);
                // Fallback to server-side upload
                const formData = new FormData();
                formData.append("file", audioBlob, fileName);
                formData.append("fileType", "voice");
                const uploadResponse = await axios.post("/api/upload", formData, { timeout: 9000 });
                fileUrl = uploadResponse.data?.fileUrl;
                fileSize = uploadResponse.data?.fileSize || audioBlob.size;
            }

            if (fileUrl) {
                // Send message with voice file
                await axios.post(`/api/messages/${selectedConv}`, {
                    senderId: user.id,
                    fileType: "voice",
                    fileUrl: fileUrl,
                    fileName: fileName,
                    fileSize: fileSize,
                    text: "🎤 Voice message",
                });
            }
        } catch (error) {
            console.error("Error sending voice message:", error);
            alert("Failed to send voice message. Please try again.");
        }
    };

    // Handle location share
    const handleLocationShare = async (location) => {
        if (!selectedConv || !user || selectedConv === "ai-chat") return;

        try {
            await axios.post(`/api/messages/${selectedConv}`, {
                senderId: user.id,
                location: {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    address: location.address,
                },
                text: "📍 Shared location",
            });
        } catch (error) {
            console.error("Error sharing location:", error);
            alert("Failed to share location. Please try again.");
        }
    };

    // Handle add reaction
    const handleAddReaction = async (messageId, emoji) => {
        if (!selectedConv || !user) return;

        try {
            await axios.post(`/api/messages/${selectedConv}/${messageId}/reactions`, {
                userId: user.id,
                emoji: emoji,
            });
        } catch (error) {
            console.error("Error adding reaction:", error);
        }
    };

    // Handle remove reaction
    const handleRemoveReaction = async (messageId, emoji) => {
        if (!selectedConv || !user) return;

        try {
            await axios.delete(`/api/messages/${selectedConv}/${messageId}/reactions`, {
                data: {
                    userId: user.id,
                    emoji: emoji,
                },
            });
        } catch (error) {
            console.error("Error removing reaction:", error);
        }
    };

    const startConversation = async (otherUserId) => {
        if (!user) return;
        try {
            const res = await axios.post('/api/conversations', { userId: user.id, otherUserId });
            const convId = res.data?.conversationId;
            if (convId) {
                try {
                    const convs = await axios.get(`/api/conversations?userId=${user.id}`);
                    setConversations(convs.data);
                } catch (_) {}
                setSearchQuery("");
                setSearchResults([]);
                setSelectedConv(convId);
                selectedConvRef.current = convId;
                await loadMessages(convId);
            }
        } catch (_) {}
    };

    const toggleMessageSelection = (messageId) => {
        if (messageId === null) {
            // Clear all selections
            setSelectedMessages(new Set());
            return;
        }
        setSelectedMessages(prev => {
            const newSet = new Set(prev);
            if (newSet.has(messageId)) {
                newSet.delete(messageId);
            } else {
                newSet.add(messageId);
            }
            return newSet;
        });
    };

    const handleSelectConversation = (convId) => {
        setSelectedConv(convId);
        selectedConvRef.current = convId;
        if (isMobile) {
            setShowSidebar(false);
        }
        if (convId === "ai-chat") {
            // Don't set up Pusher channels for AI chat
            loadMessages(convId);
        } else {
            loadMessages(convId);
        }
    };

    const handleBackToList = () => {
        if (isMobile) {
            setShowSidebar(true);
            setSelectedConv(null);
            selectedConvRef.current = null;
            setMessages([]);
        }
    };

    const translateSelectedMessage = async (messageId, targetLang) => {
        try {
            setIsTranslatingMessage(true);
            const message = messages.find(m => m._id === messageId);
            if (!message) return;

            if (!message.text || typeof message.text !== 'string' || message.text.trim().length === 0) {
                alert("Cannot translate file-only messages");
                return;
            }

            const source = message.lang || "auto";
            if (targetLang === source) return;

            const resp = await axios.post('/api/translate', {
                q: message.text,
                source,
                target: targetLang
            });

            setMessages(prev => prev.map(m =>
                m._id === messageId
                    ? { ...m, translatedText: resp.data?.translatedText || m.text }
                    : m
            ));

            const key = `${messageId}:${targetLang}`;
            translateCacheRef.current.set(key, resp.data?.translatedText || message.text);

            setSelectedMessages(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });
        } catch (error) {
            alert("Failed to translate message");
        } finally {
            setIsTranslatingMessage(false);
        }
    };

    const deleteMessage = async (messageId) => {
        if (!selectedConv || !user) return;

            setIsDeletingMessage(true);
        try {
            await axios.delete(`/api/messages/${selectedConv}/${messageId}`, {
                data: { userId: user.id }
            });
            setMessages(prev => prev.filter(m => m._id !== messageId));
            setSelectedMessages(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });
            setSelectedMessageForDeletion(null);
        } catch (error) {
            alert("Failed to delete message");
        } finally {
            setIsDeletingMessage(false);
        }
    };

    const saveRecvLang = async (lang) => {
        setRecvLang(lang);
        const otherUser = conversations
            .find((c) => c._id === selectedConv)
            ?.participants?.find((p) => p?._id !== user?.id);
        if (!otherUser || !user) return;
        try {
            await axios.put(`/api/users/prefs?userId=${user?.id}`, {
                targetUserId: otherUser?._id,
                targetLang: lang,
            });
        } catch (_) {}
    };

    const handleArchiveConversation = async () => {
        if (!selectedConv || !user) return;
        try {
            const archiveResponse = await axios.post(`/api/conversations/${selectedConv}/archive`, { userId: user.id });
            
            if (archiveResponse.data?.archived) {
                // Reload conversations (non-archived)
                const res = await axios.get(`/api/conversations?userId=${user?.id}`);
                const list = Array.isArray(res?.data) ? res.data : [];
                const map = new Map(list.map((c) => [c?._id, c]).filter(([id]) => id));
                setConversations(Array.from(map.values()));
                
                // Reload archived conversations
                const archivedRes = await axios.get(`/api/conversations?userId=${user?.id}&includeArchived=true`);
                const archivedList = Array.isArray(archivedRes?.data) ? archivedRes.data : [];
                // The API already filters to only archived conversations, so we can use them directly
                const archivedMap = new Map(archivedList.map((c) => [c?._id, c]).filter(([id]) => id));
                setArchivedConversations(Array.from(archivedMap.values()));
                
                // Clear selected conversation
                setSelectedConv(null);
                setMessages([]);
            }
        } catch (error) {
            alert("Failed to archive conversation: " + (error.response?.data?.error || error.message));
        }
    };

    const handleUnarchiveConversation = async (convId) => {
        if (!convId || !user) return;
        try {
            await axios.delete(`/api/conversations/${convId}/archive`, { data: { userId: user?.id } });
            // Reload conversations
            const res = await axios.get(`/api/conversations?userId=${user?.id}`);
            const list = Array.isArray(res?.data) ? res.data : [];
            const map = new Map(list.map((c) => [c?._id, c]).filter(([id]) => id));
            setConversations(Array.from(map.values()));
            
            // Reload archived conversations
            const archivedRes = await axios.get(`/api/conversations?userId=${user?.id}&includeArchived=true`);
            const archivedList = Array.isArray(archivedRes?.data) ? archivedRes.data : [];
            const archivedMap = new Map(archivedList.map((c) => [c?._id, c]).filter(([id]) => id));
            setArchivedConversations(Array.from(archivedMap.values()));
        } catch (error) {
            alert("Failed to unarchive conversation");
        }
    };


    const handleLogout = async () => {
        setIsLoggingOut(true);
        try {
            presenceRef.current?.unbind_all?.();
            if (presenceRef.current) {
                pusherRef.current?.unsubscribe(presenceRef.current.name);
            }
            pusherRef.current?.disconnect?.();
        } catch (_) {}
        localStorage.removeItem("user");
        router.push("/");
    };

    // Smooth scroll on new messages
    useEffect(() => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) scrollToBottom();
    }, [messages]);

    // After messages finish loading or on conversation change, jump to bottom once
    useEffect(() => {
        if (isLoadingMessages) return;
        requestAnimationFrame(() => scrollToBottom());
    }, [isLoadingMessages, selectedConv, messages.length]);

    // Update selectedConvRef when selectedConv changes
    useEffect(() => {
        selectedConvRef.current = selectedConv;
    }, [selectedConv]);

    // When switching conversations, scroll to bottom
    useEffect(() => {
        if (!selectedConv) return;
        const id = setTimeout(() => scrollToBottom(), 0);
        return () => clearTimeout(id);
    }, [selectedConv]);

    // Scroll to bottom when AI starts generating
    useEffect(() => {
        if (isAILoading && selectedConv === "ai-chat") {
            setTimeout(() => scrollToBottom(), 100);
        }
    }, [isAILoading, selectedConv]);

    if (!user) {
        return (
            <div className={`${dark ? "dark" : ""} h-screen flex items-center justify-center bg-gradient-to-br from-white via-blue-50/40 to-blue-100/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`}>
                <div className="flex flex-col items-center gap-3 text-gray-600 dark:text-gray-300">
                    <div className="w-10 h-10 border-4 border-blue-500/40 border-t-blue-600 rounded-full animate-spin"></div>
                    <p className="text-sm font-medium">Loading chats...</p>
                </div>
            </div>
        );
    }

    // Find otherUser from either regular or archived conversations, or handle AI chat
    let otherUser = null;
    let isOtherOnline = false;
    let otherUserId = null;
    
    if (selectedConv === "ai-chat") {
        // AI chat - try to find AI user from conversation or create virtual object
        const aiConv = conversations.find(c => {
            const otherUser = c.participants?.find(p => {
                const userEmail = p.email;
                return userEmail === "ai@assistant.com";
            });
            return otherUser !== undefined;
        });
        
        if (aiConv) {
            otherUser = aiConv?.participants?.find(p => p?.email === "ai@assistant.com");
        } else {
            // Virtual AI user object if conversation not loaded yet
            otherUser = {
                _id: "ai-assistant",
                name: "AI Assistant",
                email: "ai@assistant.com"
            };
        }
        isOtherOnline = true; // AI is always "online"
        otherUserId = otherUser?._id || "ai-assistant";
    } else {
        const selectedConversation = conversations.find((c) => c?._id === selectedConv) 
            || archivedConversations.find((c) => c?._id === selectedConv);
        otherUser = selectedConversation?.participants?.find((p) => p?._id !== user?.id);
        isOtherOnline = otherUser ? onlineUsers.some((u) => u?.id === otherUser?._id) : false;
        otherUserId = otherUser?._id;
    }

    return (
        <div className={`${dark ? "dark" : ""} h-screen flex flex-col lg:flex-row bg-gradient-to-br from-white via-blue-50/40 to-blue-100/50 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900`}>
            {isMobile ? (
                <>
                    {showSidebar && (
                        <div className="flex-1 min-h-0">
                            <Sidebar
                                dark={dark}
                                toggleDark={toggleDark}
                                searchQuery={searchQuery}
                                setSearchQuery={setSearchQuery}
                                searchResults={searchResults}
                                isSearching={isSearching}
                                onStartConversation={startConversation}
                                conversations={conversations}
                                archivedConversations={archivedConversations}
                                user={user}
                                onlineUsers={onlineUsers}
                                selectedConv={selectedConv}
                                onSelectConversation={handleSelectConversation}
                                onUnarchiveConversation={handleUnarchiveConversation}
                                onLogout={handleLogout}
                            isLoggingOut={isLoggingOut}
                            isLoadingChats={isLoadingChats}
                            />
                        </div>
                    )}

                    {!showSidebar && (
                        <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-blue-50/40 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 min-h-0 shadow-inner">
                            {selectedConv ? (
                                <>
                                    <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 shadow-sm">
                                        <ChatHeader
                                            otherUserName={otherUser?.name}
                                            recvLang={recvLang}
                                            onRecvLangChange={saveRecvLang}
                                            typingUsers={typingUsers}
                                            isOtherOnline={isOtherOnline}
                                            conversationId={selectedConv}
                                            otherUser={otherUser}
                                            user={user}
                                            pusherRef={pusherRef.current}
                                            onOutgoingCall={setIsOutgoingCall}
                                            messages={messages}
                                            onDeleteConversation={async () => {}}
                                            isArchived={archivedConversations.some((c) => c?._id === selectedConv)}
                                            onArchiveConversation={handleArchiveConversation}
                                            onUnarchiveConversation={() => handleUnarchiveConversation(selectedConv)}
                                            onBackMobile={handleBackToList}
                                            showBackButton
                                        />
                                    </div>

                                    {isLoadingMessages ? (
                                        <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                            <div className="flex flex-col items-center gap-3">
                                                <div className="w-10 h-10 border-4 border-blue-500/40 border-t-blue-600 rounded-full animate-spin"></div>
                                                <p className="text-sm font-medium">Loading messages...</p>
                                            </div>
                                        </div>
                                    ) : (
                                    <MessageList
                                        messages={messages}
                                        user={user}
                                        selectedMessages={selectedMessages}
                                        onToggleMessageSelection={toggleMessageSelection}
                                        onTranslateMessage={setSelectedMessageForTranslation}
                                        onDeleteMessage={setSelectedMessageForDeletion}
                                        formatFileSize={formatFileSize}
                                        otherUserId={otherUserId}
                                        isTranslatingMessage={isTranslatingMessage}
                                        isDeletingMessage={isDeletingMessage}
                                        messagesContainerRef={messagesContainerRef}
                                        messagesEndRef={messagesEndRef}
                                        typingUsers={typingUsers}
                                        isAIGenerating={isAILoading && selectedConv === "ai-chat"}
                                        currentUserId={user?.id}
                                        onAddReaction={handleAddReaction}
                                        onRemoveReaction={handleRemoveReaction}
                                    />
                                    )}

                                    <div className="sticky bottom-0 z-10">
                                        <MessageInput
                                            newMsg={newMsg}
                                            setNewMsg={setNewMsg}
                                            onSend={sendMessage}
                                            fileInputRef={fileInputRef}
                                            handleFileSelect={handleFileSelect}
                                            selectedFile={selectedFile}
                                            removeSelectedFile={removeSelectedFile}
                                            isUploading={isUploading || isAILoading}
                                            conversationId={selectedConv}
                                            user={user}
                                            isAIChat={selectedConv === "ai-chat"}
                                            onVoiceMessage={handleVoiceMessage}
                                            onLocationShare={handleLocationShare}
                                        />
                                    </div>
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                    Select a conversation to start chatting.
                                </div>
                            )}
                        </div>
                    )}
                </>
            ) : (
                <>
                    <Sidebar
                        dark={dark}
                        toggleDark={toggleDark}
                        searchQuery={searchQuery}
                        setSearchQuery={setSearchQuery}
                        searchResults={searchResults}
                        isSearching={isSearching}
                        onStartConversation={startConversation}
                        conversations={conversations}
                        archivedConversations={archivedConversations}
                        user={user}
                        onlineUsers={onlineUsers}
                        selectedConv={selectedConv}
                        onSelectConversation={handleSelectConversation}
                        onUnarchiveConversation={handleUnarchiveConversation}
                        onLogout={handleLogout}
                        isLoggingOut={isLoggingOut}
                        isLoadingChats={isLoadingChats}
                    />

                    <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-blue-50/40 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 min-h-0 shadow-inner">
                        {selectedConv ? (
                            <>
                                <div className="sticky top-0 z-20 bg-white/95 dark:bg-gray-900/95 shadow-sm">
                                    <ChatHeader
                                        otherUserName={otherUser?.name}
                                        recvLang={recvLang}
                                        onRecvLangChange={saveRecvLang}
                                        isOtherOnline={isOtherOnline}
                                        conversationId={selectedConv}
                                        otherUser={otherUser}
                                        user={user}
                                        pusherRef={pusherRef.current}
                                        onOutgoingCall={setIsOutgoingCall}
                                        messages={messages}
                                        onDeleteConversation={async () => {}}
                                        isArchived={archivedConversations.some((c) => c?._id === selectedConv)}
                                        onArchiveConversation={handleArchiveConversation}
                                        onUnarchiveConversation={() => handleUnarchiveConversation(selectedConv)}
                                    />
                                </div>

                                {isLoadingMessages ? (
                                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                        <div className="flex flex-col items-center gap-3">
                                            <div className="w-10 h-10 border-4 border-blue-500/40 border-t-blue-600 rounded-full animate-spin"></div>
                                            <p className="text-sm font-medium">Loading messages...</p>
                                        </div>
                                    </div>
                                ) : (
                                    <MessageList
                                        messages={messages}
                                        user={user}
                                        selectedMessages={selectedMessages}
                                        onToggleMessageSelection={toggleMessageSelection}
                                        onTranslateMessage={setSelectedMessageForTranslation}
                                        onDeleteMessage={setSelectedMessageForDeletion}
                                        formatFileSize={formatFileSize}
                                        otherUserId={otherUserId}
                                        isTranslatingMessage={isTranslatingMessage}
                                        isDeletingMessage={isDeletingMessage}
                                        messagesContainerRef={messagesContainerRef}
                                        messagesEndRef={messagesEndRef}
                                        typingUsers={typingUsers}
                                        isAIGenerating={isAILoading && selectedConv === "ai-chat"}
                                        currentUserId={user?.id}
                                        onAddReaction={handleAddReaction}
                                        onRemoveReaction={handleRemoveReaction}
                                    />
                                )}

                                <div className="sticky bottom-0 z-10">
                                    <MessageInput
                                        newMsg={newMsg}
                                        setNewMsg={setNewMsg}
                                        onSend={sendMessage}
                                        fileInputRef={fileInputRef}
                                        handleFileSelect={handleFileSelect}
                                        selectedFile={selectedFile}
                                        removeSelectedFile={removeSelectedFile}
                                        isUploading={isUploading || isAILoading}
                                        conversationId={selectedConv}
                                        user={user}
                                        isAIChat={selectedConv === "ai-chat"}
                                        onVoiceMessage={handleVoiceMessage}
                                        onLocationShare={handleLocationShare}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                                Select a conversation to start chatting.
                            </div>
                        )}
                    </div>
                </>
            )}

            <TranslationModal
                message={selectedMessageForTranslation}
                onTranslate={translateSelectedMessage}
                onClose={() => setSelectedMessageForTranslation(null)}
            />

            <DeleteConfirmationModal
                message={selectedMessageForDeletion}
                onConfirm={() => deleteMessage(selectedMessageForDeletion?._id)}
                onCancel={() => setSelectedMessageForDeletion(null)}
            />

            {showCallModal && incomingCall && !isOutgoingCall && (
                    <CallModal
                        conversationId={selectedConv}
                        otherUser={incomingCall.from}
                        user={user}
                        onClose={() => {
                            setShowCallModal(false);
                            setIncomingCall(null);
                        }}
                        pusherRef={pusherRef.current}
                        isIncoming={true}
                        incomingOffer={incomingCall.sdp}
                        isOutgoingCall={isOutgoingCall}
                        callType={incomingCall.callType || "video"}
                    />
            )}
        </div>
    );
}