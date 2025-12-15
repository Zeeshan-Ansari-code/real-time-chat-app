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
    const [newMsg, setNewMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [dark, setDark] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [langPrefs, setLangPrefs] = useState({});
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

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const pusherRef = useRef(null);
    const presenceRef = useRef(null);
    const conversationChannelsRef = useRef({});
    const selectedConvRef = useRef(null);
    const conversationsRef = useRef([]);
    const userRef = useRef(null);

    // Custom hooks
    const {
        recvLang,
        setRecvLang,
        isTranslating,
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
        if (!stored) router.push("/");
        else {
            const parsed = JSON.parse(stored);
            setUser(parsed);
            // Load regular conversations
            axios
                .get(`/api/conversations?userId=${parsed.id}`)
                .then((res) => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    const map = new Map(list.map((c) => [c._id, c]));
                    setConversations(Array.from(map.values()));
                });
            
            // Load archived conversations
            axios
                .get(`/api/conversations?userId=${parsed.id}&includeArchived=true`)
                .then((res) => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    // The API already filters to only archived conversations
                    const map = new Map(list.map((c) => [c._id, c]));
                    setArchivedConversations(Array.from(map.values()));
                })
                .catch((err) => {
                    // If error, set empty array
                    setArchivedConversations([]);
                });
        }
    }, [router]);

    // Load language preferences
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const res = await axios.get(`/api/users/prefs?userId=${user.id}`);
                setLangPrefs(res.data || {});
            } catch (_) {}
        })();
    }, [user]);

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
                const res = await axios.get(`/api/users/search?q=${encodeURIComponent(q)}&userId=${user.id}`);
                setSearchResults(res.data || []);
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
                    let userId = member.id || member.user_id || member.userId;
                    let userName = member.info?.name || member.name || 'Unknown';
                    if (userId !== user.id) {
                        online.push({ id: userId, name: userName });
                    }
                });
                setOnlineUsers(online);
            });

            presenceChannel.bind("pusher:subscription_error", (error) => {});

            presenceChannel.bind("pusher:member_added", (member) => {
                let userId = member.id || member.user_id || member.userId;
                let userName = member.info?.name || member.name || 'Unknown';
                if (userId !== user.id) {
                    setOnlineUsers((prev) => [...prev, { id: userId, name: userName }]);
                }
            });

            presenceChannel.bind("pusher:member_removed", (member) => {
                setOnlineUsers((prev) => {
                    const filtered = prev.filter((u) => u.id !== member.id);
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
        const channel = pusher.subscribe(`user-${user.id}`);

        const handleUpsert = async ({ conversationId }) => {
            try {
                const res = await axios.get(`/api/conversations?userId=${user.id}`);
                const newList = Array.isArray(res.data) ? res.data : [];
                const newMap = new Map(newList.map((c) => [c._id, c]));
                setConversations(Array.from(newMap.values()));
            } catch (_) {}
        };

        channel.bind("conversation-upsert", handleUpsert);

        return () => {
            try { channel.unbind("conversation-upsert", handleUpsert); } catch (_) {}
            try { pusher.unsubscribe(`user-${user.id}`); } catch (_) {}
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
                setShowSidebar(selectedConv ? false : true);
            }
        };
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, [selectedConv]);

    const loadMessages = async (convId) => {
        setSelectedConv(convId);
        selectedConvRef.current = convId;
        const res = await axios.get(`/api/messages/${convId}`);
        setMessages(res.data);
        setTimeout(() => scrollToBottom(), 0);
        setConversations((prev) => prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c)));

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
            const isFromMe = (data.sender?._id || data.sender) === user.id;
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
        } catch (error) {}
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

    const handleSelectConversation = async (convId) => {
        await loadMessages(convId);
        if (isMobile) {
            setShowSidebar(false);
        }
    };

    const handleBackToList = () => {
        if (isMobile) {
            setShowSidebar(true);
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
            ?.participants.find((p) => p._id !== user.id);
        if (!otherUser || !user) return;
        try {
            await axios.put(`/api/users/prefs?userId=${user.id}`, {
                targetUserId: otherUser._id,
                targetLang: lang,
            });
            setLangPrefs((prev) => ({ ...prev, [otherUser._id]: lang }));
        } catch (_) {}
    };

    const handleArchiveConversation = async () => {
        if (!selectedConv || !user) return;
        try {
            const archiveResponse = await axios.post(`/api/conversations/${selectedConv}/archive`, { userId: user.id });
            
            if (archiveResponse.data?.archived) {
                // Reload conversations (non-archived)
                const res = await axios.get(`/api/conversations?userId=${user.id}`);
                const list = Array.isArray(res.data) ? res.data : [];
                const map = new Map(list.map((c) => [c._id, c]));
                setConversations(Array.from(map.values()));
                
                // Reload archived conversations
                const archivedRes = await axios.get(`/api/conversations?userId=${user.id}&includeArchived=true`);
                const archivedList = Array.isArray(archivedRes.data) ? archivedRes.data : [];
                // The API already filters to only archived conversations, so we can use them directly
                const archivedMap = new Map(archivedList.map((c) => [c._id, c]));
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
            await axios.delete(`/api/conversations/${convId}/archive`, { data: { userId: user.id } });
            // Reload conversations
            const res = await axios.get(`/api/conversations?userId=${user.id}`);
            const list = Array.isArray(res.data) ? res.data : [];
            const map = new Map(list.map((c) => [c._id, c]));
            setConversations(Array.from(map.values()));
            
            // Reload archived conversations
            const archivedRes = await axios.get(`/api/conversations?userId=${user.id}&includeArchived=true`);
            const archivedList = Array.isArray(archivedRes.data) ? archivedRes.data : [];
            const archivedMap = new Map(archivedList.map((c) => [c._id, c]));
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
        // Small delay to show loading state
        await new Promise(resolve => setTimeout(resolve, 500));
        router.push("/");
    };

    // Smooth scroll on new messages
    useEffect(() => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) scrollToBottom();
    }, [messages]);

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

    if (!user) return <p>Loading...</p>;

    // Find otherUser from either regular or archived conversations
    const selectedConversation = conversations.find((c) => c._id === selectedConv) 
        || archivedConversations.find((c) => c._id === selectedConv);
    const otherUser = selectedConversation?.participants.find((p) => p._id !== user.id);

    const isOtherOnline = otherUser ? onlineUsers.some((u) => u.id === otherUser._id) : false;
    const otherUserId = otherUser?._id;

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
                            />
                        </div>
                    )}

                    {!showSidebar && (
                        <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-blue-50/40 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 min-h-0 shadow-inner">
                            {selectedConv ? (
                                <>
                                    <ChatHeader
                                        otherUserName={otherUser?.name}
                                        recvLang={recvLang}
                                        onRecvLangChange={saveRecvLang}
                                        isTranslating={isTranslating}
                                        typingUsers={typingUsers}
                                        isOtherOnline={isOtherOnline}
                                        conversationId={selectedConv}
                                        otherUser={otherUser}
                                        user={user}
                                        pusherRef={pusherRef.current}
                                        onOutgoingCall={setIsOutgoingCall}
                                        messages={messages}
                                        onDeleteConversation={async () => {}}
                                        isArchived={archivedConversations.some((c) => c._id === selectedConv)}
                                        onArchiveConversation={handleArchiveConversation}
                                        onUnarchiveConversation={() => handleUnarchiveConversation(selectedConv)}
                                        onBackMobile={handleBackToList}
                                        showBackButton
                                    />

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
                                    />

                                    <MessageInput
                                        newMsg={newMsg}
                                        setNewMsg={setNewMsg}
                                        onSend={sendMessage}
                                        fileInputRef={fileInputRef}
                                        handleFileSelect={handleFileSelect}
                                        selectedFile={selectedFile}
                                        removeSelectedFile={removeSelectedFile}
                                        isUploading={isUploading}
                                        conversationId={selectedConv}
                                        user={user}
                                    />
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
                    />

                    <div className="flex-1 flex flex-col bg-gradient-to-br from-white via-blue-50/40 to-blue-100/30 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 min-h-0 shadow-inner">
                        {selectedConv ? (
                            <>
                                <ChatHeader
                                    otherUserName={otherUser?.name}
                                    recvLang={recvLang}
                                    onRecvLangChange={saveRecvLang}
                                    isTranslating={isTranslating}
                                    typingUsers={typingUsers}
                                    isOtherOnline={isOtherOnline}
                                    conversationId={selectedConv}
                                    otherUser={otherUser}
                                    user={user}
                                    pusherRef={pusherRef.current}
                                    onOutgoingCall={setIsOutgoingCall}
                                    messages={messages}
                                    onDeleteConversation={async () => {}}
                                    isArchived={archivedConversations.some((c) => c._id === selectedConv)}
                                    onArchiveConversation={handleArchiveConversation}
                                    onUnarchiveConversation={() => handleUnarchiveConversation(selectedConv)}
                                />

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
                                />

                                <MessageInput
                                    newMsg={newMsg}
                                    setNewMsg={setNewMsg}
                                    onSend={sendMessage}
                                    fileInputRef={fileInputRef}
                                    handleFileSelect={handleFileSelect}
                                    selectedFile={selectedFile}
                                    removeSelectedFile={removeSelectedFile}
                                    isUploading={isUploading}
                                    conversationId={selectedConv}
                                    user={user}
                                />
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
                    />
            )}
        </div>
    );
}
