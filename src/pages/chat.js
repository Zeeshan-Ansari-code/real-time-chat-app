"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { pusherClient } from "@/lib/pusherClient";
import { Sun, Moon, Search, MoreVertical, File } from "lucide-react";
import CallButton from "@/components/call/CallButton";
import CallModal from "@/components/call/CallModal";

export default function ChatPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [conversations, setConversations] = useState([]);
    const [selectedConv, setSelectedConv] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMsg, setNewMsg] = useState("");
    const [typingUsers, setTypingUsers] = useState([]);
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [dark, setDark] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState([]);
    const [isSearching, setIsSearching] = useState(false);
    const [recvLang, setRecvLang] = useState("");
    const [langPrefs, setLangPrefs] = useState({});

    const messagesEndRef = useRef(null);
    const messagesContainerRef = useRef(null);
    const typingTimeoutRef = useRef(null);
    const pusherRef = useRef(null);
    const presenceRef = useRef(null);
    const conversationChannelsRef = useRef({});
    const recvLangRef = useRef("");
    const translatingCounterRef = useRef(0);
    const [isTranslating, setIsTranslating] = useState(false);
    const translateCacheRef = useRef(new Map()); // key: `${msgId}:${target}` -> text
    const [selectedMessages, setSelectedMessages] = useState(new Set());
    const [showMessageActions, setShowMessageActions] = useState(false);
    const [selectedMessageForTranslation, setSelectedMessageForTranslation] = useState(null);
    const [selectedMessageForDeletion, setSelectedMessageForDeletion] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDeletingMessage, setIsDeletingMessage] = useState(false);
    const [isTranslatingMessage, setIsTranslatingMessage] = useState(false);
    const fileInputRef = useRef(null);
    const [selectedFile, setSelectedFile] = useState(null);
    
    // Video call state
    const [incomingCall, setIncomingCall] = useState(null);
    const [showCallModal, setShowCallModal] = useState(false);
    const [isOutgoingCall, setIsOutgoingCall] = useState(false); // Track if user is making outgoing call



    // Note: keep console output enabled for debugging

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
            axios
                .get(`/api/conversations?userId=${parsed.id}`)
                .then((res) => {
                    const list = Array.isArray(res.data) ? res.data : [];
                    const map = new Map(list.map((c) => [c._id, c]));
                    setConversations(Array.from(map.values()));
                });
        }
    }, [router]);

    // Load receiver language preferences map for current user (top-level, stable hooks)
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const res = await axios.get(`/api/users/prefs?userId=${user.id}`);
                setLangPrefs(res.data || {});
            } catch (_) { }
        })();
    }, [user]);

    // Note: Removed automatic loading of saved language preferences
    // Users will now start with "Auto" for each conversation by default
    // Saved preferences can still be applied manually if needed

    // Keep a ref of the latest recvLang for realtime handlers
    useEffect(() => {
        recvLangRef.current = recvLang;
    }, [recvLang]);

    // Translate currently loaded messages when target language changes
    useEffect(() => {
        if (!selectedConv) return;
        const target = recvLangRef.current;
        if (!target) {
            // clear translatedText if Auto
            setMessages((prev) => prev.map((m) => ({ ...m, translatedText: undefined })));
            return;
        }
        let cancelled = false;
        setIsTranslating(true);
        (async () => {
            const msgs = (messages || []).slice(-50); // limit to recent 50 to keep UI snappy
            const cache = translateCacheRef.current;
            const jobs = [];
            for (const m of msgs) {
                const source = m.lang || "auto";
                if (target === source) continue;
                // Only translate messages that have meaningful text content
                if (!m.text || typeof m.text !== 'string' || m.text.trim().length === 0) continue;
                const key = `${m._id}:${target}`;
                if (!cache.has(key)) {
                    jobs.push(async () => {
                        try {
                            const resp = await axios.post('/api/translate', { q: m.text, source, target });
                            cache.set(key, resp.data?.translatedText || m.text);
                        } catch (_) {
                            cache.set(key, m.text);
                        }
                    });
                }
            }

            // Run jobs in small parallel chunks
            const concurrency = 4;
            for (let i = 0; i < jobs.length; i += concurrency) {
                if (cancelled) break;
                await Promise.all(jobs.slice(i, i + concurrency).map((fn) => fn()));
            }

            if (cancelled) return;
            setMessages((prev) => prev.map((m) => {
                const key = `${m._id}:${target}`;
                return { ...m, translatedText: cache.get(key) };
            }));
            setIsTranslating(false);
        })();
        return () => { cancelled = true; setIsTranslating(false); };
    }, [recvLang, selectedConv]);

    // When switching conversations, default dropdown to Auto and clear any translations
    useEffect(() => {
        if (!selectedConv) return;
        setRecvLang("");
        recvLangRef.current = "";
        setMessages((prev) => prev.map((m) => ({ ...m, translatedText: undefined })));
    }, [selectedConv]);

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

    // Load receiver language preferences map for current user
    useEffect(() => {
        if (!user) return;
        (async () => {
            try {
                const res = await axios.get(`/api/users/prefs?userId=${user.id}`);
                setLangPrefs(res.data || {});
            } catch (_) { }
        })();
    }, [user]);

    // Note: Removed automatic loading of saved language preferences
    // Users will now start with "Auto" for each conversation by default
    // Saved preferences can still be applied manually if needed

    const startConversation = async (otherUserId) => {
        if (!user) return;
        try {
            const res = await axios.post('/api/conversations', { userId: user.id, otherUserId });
            const convId = res.data?.conversationId;
            if (convId) {
                // ensure sidebar has latest
                try {
                    const convs = await axios.get(`/api/conversations?userId=${user.id}`);
                    setConversations(convs.data);
                } catch (_) { }
                setSearchQuery("");
                setSearchResults([]);
                await loadMessages(convId);
            }
        } catch (_) { }
    };

    // Subscribe to conversation channels to keep sidebar lastMessage/unread in sync
    useEffect(() => {
        if (!user) return;
        if (!pusherRef.current) return;
        if (!Array.isArray(conversations)) return;

        console.log("🔗 Setting up conversation channels for user:", user.id);
        console.log("🔗 Pusher client state:", pusherRef.current.connection.state);
        console.log("🔗 Conversations count:", conversations.length);

        // Wait for Pusher client to be fully connected before subscribing to channels
        const waitForPusherConnection = () => {
            if (pusherRef.current.connection.state === 'connected') {
                console.log("🔗 Pusher client connected, setting up conversation channels...");
                setupConversationChannels();
            } else {
                console.log("🔗 Waiting for Pusher client connection... Current state:", pusherRef.current.connection.state);
                setTimeout(waitForPusherConnection, 100);
            }
        };

        // Start waiting for connection
        waitForPusherConnection();

        function setupConversationChannels() {
            const pusher = pusherRef.current;
            const existing = conversationChannelsRef.current;

            const activeIds = new Set(conversations.map((c) => c._id));

            // Unsubscribe channels no longer needed
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
                    } catch (_) { }
                    delete existing[convId];
                }
            });

            // Subscribe/bind for each conversation
            conversations.forEach((conv) => {
                const convId = conv._id;
                if (existing[convId]) return;

                console.log(`🔗 Subscribing to conversation channel: conversation-${convId}`);
                console.log(`🔗 Pusher connection state before subscription:`, pusher.connection.state);
                console.log(`🔗 User info for auth:`, { id: user.id, name: user.name });

                // Subscribe to both regular conversation channel and presence channel for video calls
                const channel = pusher.subscribe(`conversation-${convId}`);
                const presenceChannel = pusher.subscribe(`presence-conversation-${convId}`);

                // Add subscription event listeners for debugging
                channel.bind('pusher:subscription_succeeded', () => {
                    console.log(`🔗 ✅ Channel conversation-${convId} subscription SUCCEEDED!`);
                });

                channel.bind('pusher:subscription_error', (error) => {
                    console.error(`🔗 ❌ Channel conversation-${convId} subscription FAILED:`, error);
                });

                // Add presence channel event listeners for video calls
                presenceChannel.bind('pusher:subscription_succeeded', () => {
                    console.log(`🔗 ✅ Presence channel presence-conversation-${convId} subscription SUCCEEDED!`);
                });

                presenceChannel.bind('pusher:subscription_error', (error) => {
                    console.error(`🔗 ❌ Presence channel presence-conversation-${convId} subscription FAILED:`, error);
                });

                // Bind video call events to presence channel
                presenceChannel.bind("call:offer", (payload) => {
                    // Only handle incoming calls from other users, not from self
                    if (String(payload.from?.id) === String(user.id)) {
                        console.log(`📞 📥 Ignoring own call offer on presence channel`);
                        return;
                    }
                    console.log(`📞 📥 Received call offer on presence channel from:`, payload.from?.name);
                    // Set incoming call state to trigger CallModal
                    setIncomingCall(payload);
                    setShowCallModal(true);
                });

                presenceChannel.bind("call:ring", (payload) => {
                    console.log(`📞 🔔 Received call ring on presence channel:`, payload);
                });

                presenceChannel.bind("call:answer", (payload) => {
                    console.log(`📞 📥 Received call answer on presence channel:`, payload);
                });

                presenceChannel.bind("call:ice", (payload) => {
                    console.log(`📞 🧊 Received ICE candidate on presence channel:`, payload);
                });

                presenceChannel.bind("call:hangup", (payload) => {
                    console.log(`📞 📵 Received call hangup on presence channel:`, payload);
                });
                console.log(`🔗 Channel created:`, channel);
                console.log(`🔗 Channel properties:`, {
                    name: channel.name,
                    state: channel.state,
                    subscribed: channel.subscribed,
                    subscriptionState: channel.subscriptionState,
                    connection: channel.connection,
                    keys: Object.keys(channel)
                });

                // Wait for channel to be properly subscribed before binding events
                const waitForChannelSubscription = () => {
                    // Check multiple possible channel state properties
                    const channelState = channel.state || channel.connection?.state || 'unknown';
                    const isSubscribed = channel.subscribed || channel.subscriptionState === 'subscribed';

                    console.log(`🔗 Channel ${convId} status:`, {
                        state: channelState,
                        subscribed: channel.subscribed,
                        subscriptionState: channel.subscriptionState,
                        connectionState: channel.connection?.state
                    });

                    if (isSubscribed) {
                        console.log(`🔗 Channel ${convId} is subscribed successfully!`);
                    } else {
                        console.log(`🔗 Waiting for channel ${convId} subscription...`);
                        setTimeout(waitForChannelSubscription, 100);
                    }
                };



                // Start waiting for channel subscription
                waitForChannelSubscription();



                // Bind to channel subscription events for logging
                channel.bind('pusher:subscription_succeeded', () => {
                    console.log(`🔗 Channel ${convId} subscription succeeded!`);
                });

                channel.bind('pusher:subscription_error', (error) => {
                    console.error(`🔗 Channel ${convId} subscription error:`, error);
                });

                // Also bind to member events for presence channels (if this is a presence channel)
                if (channel.name.includes('presence')) {
                    channel.bind('pusher:member_added', (member) => {
                        console.log(`🔗 Member added to ${convId}:`, member);
                    });

                    channel.bind('pusher:member_removed', (member) => {
                        console.log(`🔗 Member removed from ${convId}:`, member);
                    });
                }

                channel.bind("new-message", (msg) => {
                    const messageConvId = (msg.conversation?._id || msg.conversation);
                    if (messageConvId !== convId) return;
                    setConversations((prev) =>
                        prev.map((c) => {
                            if (c._id !== convId) return c;
                            const isFromMe = (msg.sender?._id || msg.sender) === user.id;
                            const isActive = selectedConv === convId;
                            return {
                                ...c,
                                lastMessage: msg,
                                unreadCount: isFromMe || isActive ? 0 : (c.unreadCount || 0) + 1,
                            };
                        })
                    );
                });

                channel.bind("messages-seen", ({ userId }) => {
                    // If I marked seen, ensure my unread count for this conversation is 0
                    if (userId === user.id) {
                        setConversations((prev) =>
                            prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c))
                        );
                    }
                });



                existing[convId] = { channel, presenceChannel };
            });

            return () => {
                // do not unsubscribe here; presence effect handles full disconnects
            };
        } // Close setupConversationChannels function
    }, [conversations, user, selectedConv]);

    // Subscribe to per-user events to upsert conversations in real-time
    useEffect(() => {
        if (!user) return;
        if (!pusherRef.current) return;

        const pusher = pusherRef.current;
        const channel = pusher.subscribe(`user-${user.id}`);

        const handleUpsert = async ({ conversationId }) => {
            try {
                // Fetch latest conversations and merge
                const res = await axios.get(`/api/conversations?userId=${user.id}`);
                const newList = Array.isArray(res.data) ? res.data : [];
                const newMap = new Map(newList.map((c) => [c._id, c]));
                setConversations(Array.from(newMap.values()));
            } catch (_) { }
        };

        channel.bind("conversation-upsert", handleUpsert);

        return () => {
            try { channel.unbind("conversation-upsert", handleUpsert); } catch (_) { }
            try { pusher.unsubscribe(`user-${user.id}`); } catch (_) { }
        };
    }, [user]);

    // Subscribe to global presence channel
    useEffect(() => {
        if (!user) return;

        // If an old client exists, clean it up first
        if (presenceRef.current) {
            try {
                presenceRef.current.unbind_all();
                const oldName = presenceRef.current.name;
                pusherRef.current?.unsubscribe(oldName);
            } catch (e) { /* noop */ }
            presenceRef.current = null;
        }
        if (pusherRef.current) {
            try {
                pusherRef.current.disconnect();
            } catch (e) { /* noop */ }
            pusherRef.current = null;
        }

        // Clear any existing online users when setting up a new presence channel
        setOnlineUsers([]);

        // Create and keep a persistent pusher client
        console.log("🔗 Creating Pusher client for user:", user.id);
        pusherRef.current = pusherClient(user);
        const pusher = pusherRef.current;
        console.log("🔗 Pusher client created:", pusher);
        console.log("🔗 Pusher client state:", pusher.connection.state);

        // Bind to connection events to track connection status
        pusher.connection.bind('connecting', () => {
            console.log("🔗 Pusher connecting...");
        });

        pusher.connection.bind('connected', () => {
            console.log("🔗 Pusher connected successfully!");
            // Only subscribe to presence channel after connection is established
            setupPresenceChannel();
        });

        pusher.connection.bind('disconnected', () => {
            console.log("🔗 Pusher disconnected");
        });

        pusher.connection.bind('error', (error) => {
            console.error("🔗 Pusher connection error:", error);
        });

        // Check if already connected (avoid duplicate setup)
        if (pusher.connection.state === 'connected') {
            console.log("🔗 Pusher already connected, setting up presence channel...");
            setupPresenceChannel();
        }

        function setupPresenceChannel() {
            // Prevent duplicate subscription
            if (presenceRef.current) {
                console.log("🔗 Presence channel already exists, skipping setup");
                return;
            }
            
            console.log("🔗 Setting up presence channel...");
            console.log("🔗 Pusher connection state before subscription:", pusher.connection.state);

            presenceRef.current = pusher.subscribe("presence-online-users");
            const presenceChannel = presenceRef.current;

            console.log("🔗 Presence channel created:", presenceChannel);
            console.log("🔗 Presence channel state:", presenceChannel.state);

            presenceChannel.bind("pusher:subscription_succeeded", (members) => {
                const online = [];
                members.each((member) => {
                    // Try to get the ID from different possible locations
                    let userId = member.id || member.user_id || member.userId;
                    let userName = member.info?.name || member.name || 'Unknown';

                    // Only add if this is not the current user
                    if (userId !== user.id) {
                        const userInfo = {
                            id: userId,
                            name: userName
                        };
                        online.push(userInfo);
                    }
                });

                setOnlineUsers(online);
            });

            presenceChannel.bind("pusher:subscription_error", (error) => {
                console.error("Presence subscription error:", error);
            });

            presenceChannel.bind("pusher:member_added", (member) => {
                // Try to get the ID from different possible locations
                let userId = member.id || member.user_id || member.userId;
                let userName = member.info?.name || member.name || 'Unknown';

                // Only add if this is not the current user
                if (userId !== user.id) {
                    const userInfo = {
                        id: userId,
                        name: userName
                    };
                    setOnlineUsers((prev) => [...prev, userInfo]);
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

    // Ensure we disconnect on tab close/refresh to emit member_removed promptly
    useEffect(() => {
        const handleBeforeUnload = () => {
            try {
                presenceRef.current?.unbind_all();
                if (presenceRef.current) {
                    pusherRef.current?.unsubscribe(presenceRef.current.name);
                }
                pusherRef.current?.disconnect();
            } catch (e) { /* noop */ }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const loadMessages = async (convId) => {
        setSelectedConv(convId);
        const res = await axios.get(`/api/messages/${convId}`);
        setMessages(res.data);
        // Ensure scroll to last message after messages render
        setTimeout(() => scrollToBottom(), 0);
        // Reset unread count for this conversation immediately
        setConversations((prev) => prev.map((c) => (c._id === convId ? { ...c, unreadCount: 0 } : c)));

        const pusher = pusherClient(user);
        const channel = pusher.subscribe(`conversation-${convId}`);
        const presenceChannel = pusher.subscribe(`presence-conversation-${convId}`);

        // Log presence channel subscription for debugging
        presenceChannel.bind("pusher:subscription_succeeded", () => {
            console.log(`🔗 ✅ LoadMessages: Presence channel presence-conversation-${convId} subscription SUCCEEDED!`);
        });

        presenceChannel.bind("pusher:subscription_error", (error) => {
            console.error(`🔗 ❌ LoadMessages: Presence channel presence-conversation-${convId} subscription FAILED:`, error);
        });

        channel.bind("new-message", async (data) => {
            let enriched = data;
            const currentTarget = recvLangRef.current;

            // Only translate if there's actual text content and a target language is set
            // Check for meaningful text content (not empty string, not just whitespace)
            const hasTextContent = data.text && typeof data.text === 'string' && data.text.trim().length > 0;
            const needsTranslate = currentTarget && currentTarget !== (data.lang || "") && hasTextContent;
            if (needsTranslate) {
                translatingCounterRef.current += 1;
                setIsTranslating(true);
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
                } finally {
                    translatingCounterRef.current = Math.max(0, translatingCounterRef.current - 1);
                    if (translatingCounterRef.current === 0) setIsTranslating(false);
                }
            }
            setMessages((prev) => [...prev, enriched]);
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

        // Bind video call events to presence channel
        presenceChannel.bind("call:offer", (payload) => {
            // Only handle incoming calls from other users, not from self
            if (String(payload.from?.id) === String(user.id)) {
                console.log(`📞 📥 LoadMessages: Ignoring own call offer`);
                return;
            }
            console.log(`📞 📥 LoadMessages: Received call offer from:`, payload.from?.name);
            // Set incoming call state to trigger CallModal
            setIncomingCall(payload);
            setShowCallModal(true);
        });

        presenceChannel.bind("call:ring", (payload) => {
            console.log(`📞 🔔 LoadMessages: Received call ring:`, payload);
        });

        presenceChannel.bind("call:answer", (payload) => {
            console.log(`📞 📥 LoadMessages: Received call answer:`, payload);
        });

        presenceChannel.bind("call:ice", (payload) => {
            console.log(`📞 🧊 LoadMessages: Received ICE candidate:`, payload);
        });

        presenceChannel.bind("call:hangup", (payload) => {
            console.log(`📞 📵 LoadMessages: Received call hangup:`, payload);
        });

        await axios.put(`/api/messages/${convId}`, { userId: user.id });
    };

    const sendMessage = async () => {
        if (!newMsg.trim() && !selectedFile) return;
        if (!selectedConv || !user) return;

        try {
            const messageData = {
                senderId: user.id,
                lang: null, // Let the server auto-detect the language
            };

            // Only add text if there's actual text content
            if (newMsg.trim()) {
                messageData.text = newMsg.trim();
            }

            // Add file data if file is selected
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
            console.error("❌ Error sending message:", error);
        }
    };

    const handleFileSelect = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check file size (50MB limit)
        if (file.size > 50 * 1024 * 1024) {
            alert("File size must be less than 50MB");
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await axios.post('/api/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setSelectedFile(response.data);
        } catch (error) {
            console.error("❌ Error uploading file:", error);
            alert("Failed to upload file");
        } finally {
            setIsUploading(false);
        }
    };

    const removeSelectedFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const toggleMessageSelection = (messageId) => {
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

    const clearMessageSelection = () => {
        setSelectedMessages(new Set());
        setShowMessageActions(false);
    };

    const translateSelectedMessage = async (messageId, targetLang) => {
        try {
            setIsTranslatingMessage(true);
            const message = messages.find(m => m._id === messageId);
            if (!message) return;

            // Don't translate file-only messages (no meaningful text content)
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

            // Update message with translation
            setMessages(prev => prev.map(m =>
                m._id === messageId
                    ? { ...m, translatedText: resp.data?.translatedText || m.text }
                    : m
            ));

            // Cache the translation
            const key = `${messageId}:${targetLang}`;
            translateCacheRef.current.set(key, resp.data?.translatedText || message.text);

            // Hide action buttons by clearing selection
            setSelectedMessages(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });

        } catch (error) {
            console.error("❌ Error translating message:", error);
            alert("Failed to translate message");
        } finally {
            setIsTranslatingMessage(false);
        }
    };

    const deleteMessage = async (messageId) => {
        if (!selectedConv || !user) return;

        try {
            setIsDeletingMessage(true);
            await axios.delete(`/api/messages/${selectedConv}/${messageId}`, {
                data: { userId: user.id }
            });

            // Remove from local state
            setMessages(prev => prev.filter(m => m._id !== messageId));

            // Hide action buttons by clearing selection
            setSelectedMessages(prev => {
                const newSet = new Set(prev);
                newSet.delete(messageId);
                return newSet;
            });

            setSelectedMessageForDeletion(null);
        } catch (error) {
            console.error("❌ Error deleting message:", error);
            alert("Failed to delete message");
        } finally {
            setIsDeletingMessage(false);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };



    // Smooth scroll on new messages
    useEffect(() => {
        if (!messagesContainerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
        if (isNearBottom) scrollToBottom();
    }, [messages]);

    // When switching conversations, scroll to bottom once messages are set
    useEffect(() => {
        if (!selectedConv) return;
        // wait a tick for DOM paint
        const id = setTimeout(() => scrollToBottom(), 0);
        return () => clearTimeout(id);
    }, [selectedConv]);



    if (!user) return <p>Loading...</p>;

    const otherUser = conversations
        .find((c) => c._id === selectedConv)
        ?.participants.find((p) => p._id !== user.id);

    const saveRecvLang = async (lang) => {
        setRecvLang(lang);
        if (!otherUser || !user) return;
        try {
            await axios.put(`/api/users/prefs?userId=${user.id}`, {
                targetUserId: otherUser._id,
                targetLang: lang,
            });
            setLangPrefs((prev) => ({ ...prev, [otherUser._id]: lang }));
        } catch (_) { }
    };

    const isOtherOnline = otherUser ? onlineUsers.some((u) => u.id === otherUser._id) : false;
    const otherUserId = otherUser?._id;

    return (
        <div className={`${dark ? "dark" : ""} h-screen flex flex-col lg:flex-row`}>
            {/* Sidebar */}
            <div className="w-full lg:w-80 xl:w-96 border-r dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl flex flex-col transition-all duration-300">
                <div className="p-4 lg:p-6 flex justify-between items-center border-b dark:border-gray-700">
                    <h3 className="text-lg lg:text-xl font-bold dark:text-white">Chats</h3>
                    <button
                        onClick={toggleDark}
                        className="p-2 lg:p-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200"
                    >
                        {dark ? <Sun size={20} /> : <Moon size={20} />}
                    </button>
                </div>
                <div className="p-4 border-b dark:border-gray-700">
                    <div className="relative">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search people by name..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl border dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200"
                        />
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    </div>
                    {searchQuery.trim().length > 0 && (
                        <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                            {isSearching && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">Searching...</div>
                            )}
                            {!isSearching && searchResults.length === 0 && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">No users found</div>
                            )}
                            {!isSearching && searchResults.map((u) => (
                                                            <button
                                key={u._id}
                                onClick={() => startConversation(u._id)}
                                className="w-full text-left px-4 py-3 rounded-xl hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 dark:hover:from-blue-900/20 dark:hover:to-purple-900/20 flex items-center justify-between transition-all duration-200 border border-transparent hover:border-blue-200 dark:hover:border-blue-700"
                            >
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-100">{u.name}</span>
                                <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full">Start chat</span>
                            </button>
                            ))}
                        </div>
                    )}
                </div>
                <ul className="flex-1 overflow-y-auto">
                    {conversations.map((c) => {
                        if (!c.participants || c.participants.length === 0) return null;
                        const otherUser = c.participants.find((p) => p._id !== user.id);
                        const isOnline = otherUser ? onlineUsers.some((u) => u.id === otherUser._id) : false;

                        return (
                            <li
                                key={c._id}
                                className={`p-4 flex items-center gap-4 cursor-pointer hover:bg-gradient-to-r hover:from-gray-50 hover:to-blue-50 dark:hover:from-gray-800 dark:hover:to-blue-900/20 transition-all duration-200 ${selectedConv === c._id ? "bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 border-r-4 border-blue-500" : ""
                                    }`}
                                onClick={() => loadMessages(c._id)}
                            >
                                <div className="relative w-12 h-12">
                                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                        {otherUser?.name?.[0] || "?"}
                                    </div>
                                    {isOnline && (
                                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-3 border-white dark:border-gray-900 shadow-lg" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="font-semibold dark:text-white">{otherUser?.name || "Unknown User"}</p>
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-[11rem]">
                                            {c.lastMessage?.text || "No messages yet"}
                                        </p>
                                        {c.unreadCount > 0 && (
                                            <span className="ml-2 inline-flex items-center justify-center min-w-[1.5rem] h-6 px-2 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs font-bold shadow-md">
                                                {c.unreadCount}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
                </ul>
                <div className="p-3 border-t dark:border-gray-700">
                                            <button
                            onClick={() => {
                                try {
                                    // best-effort disconnect
                                    presenceRef.current?.unbind_all?.();
                                    if (presenceRef.current) {
                                        pusherRef.current?.unsubscribe(presenceRef.current.name);
                                    }
                                    pusherRef.current?.disconnect?.();
                                } catch (_) { }
                                localStorage.removeItem("user");
                                router.push("/");
                            }}
                            className="w-full text-sm bg-gradient-to-r from-red-500 to-pink-600 hover:from-red-600 hover:to-pink-700 text-white py-3 rounded-xl font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
                        >
                            Logout
                        </button>
                </div>
            </div>

            {/* Chat Window */}
            <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-950 min-h-0">
                {selectedConv ? (
                    <>
                        {/* Header */}
                        <div className="p-4 lg:p-6 border-b dark:border-gray-700 bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex justify-between items-center">
                            <div className="flex-1 min-w-0">
                                <h2 className="font-semibold text-gray-800 dark:text-white text-lg lg:text-xl truncate">
                                    {
                                        conversations
                                            .find((c) => c._id === selectedConv)
                                            ?.participants.find((p) => p._id !== user.id)?.name || "Unknown User"
                                    }
                                </h2>
                                <div className="mt-2 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3">
                                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium whitespace-nowrap">Translate to:</span>
                                    <select
                                        value={recvLang}
                                        onChange={(e) => saveRecvLang(e.target.value)}
                                        className="text-sm border dark:border-gray-600 rounded-lg px-3 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 min-w-0"
                                    >
                                        <option value="">Auto</option>
                                        <option value="en">English</option>
                                        <option value="hi">Hindi</option>
                                        <option value="es">Spanish</option>
                                        <option value="fr">French</option>
                                        <option value="de">German</option>
                                    </select>
                                    {isTranslating && (
                                        <span className="text-xs text-blue-600 dark:text-blue-400 font-medium flex items-center gap-1">
                                            <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                            Translating...
                                        </span>
                                    )}
                                </div>
                                <p className="text-xs text-gray-600 dark:text-gray-400 font-medium flex items-center gap-2">
                                    {typingUsers.length > 0 ? (
                                        <>
                                            <span className="flex space-x-1">
                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></span>
                                                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                                            </span>
                                            {typingUsers.join(", ")} is typing...
                                        </>
                                    ) : (
                                        <>
                                            <span className={`w-2 h-2 rounded-full ${isOtherOnline ? 'bg-green-500' : 'bg-gray-400'}`}></span>
                                            {isOtherOnline ? "online" : "offline"}
                                        </>
                                    )}
                                </p>

                            </div>
                            <div className="flex gap-2 lg:gap-3 text-gray-600 dark:text-gray-300">
                                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
                                    <Search className="w-5 h-5" />
                                </button>
                                <button className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors duration-200">
                                    <MoreVertical className="w-5 h-5" />
                                </button>
                                <CallButton
                                    conversationId={selectedConv}
                                    otherUser={otherUser}
                                    user={user}
                                    pusherRef={pusherRef.current}
                                    onOutgoingCall={setIsOutgoingCall}
                                />
                            </div>
                        </div>

                        {/* Messages */}
                        <div
                            ref={messagesContainerRef}
                            className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3 lg:space-y-4"
                        >
                            {messages.map((m) => (
                                <div
                                    key={m._id}
                                    className={`flex flex-col items-end space-y-1 relative ${selectedMessages.has(m._id) ? 'bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2' : ''
                                        }`}
                                >
                                    <div
                                        className={`max-w-[85%] sm:max-w-sm lg:max-w-md px-4 sm:px-6 py-3 sm:py-4 rounded-2xl shadow-lg relative transition-all duration-200 hover:shadow-xl ${m.sender._id === user.id
                                            ? "ml-auto bg-gradient-to-r from-blue-500 to-purple-600 text-white"
                                            : "mr-auto bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700"
                                            }`}
                                        onClick={() => toggleMessageSelection(m._id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        {/* File attachment */}
                                        {m.fileUrl && (
                                            <div className="mb-2">
                                                {m.fileType === 'image' && (
                                                    <img
                                                        src={m.fileUrl}
                                                        alt={m.fileName || 'Image'}
                                                        className="max-w-full h-auto rounded-lg"
                                                        style={{ maxHeight: '200px' }}
                                                    />
                                                )}
                                                {m.fileType === 'video' && (
                                                    <video
                                                        src={m.fileUrl}
                                                        controls
                                                        className="max-w-full h-auto rounded-lg"
                                                        style={{ maxHeight: '200px' }}
                                                    />
                                                )}
                                                {m.fileType === 'audio' && (
                                                    <audio
                                                        src={m.fileUrl}
                                                        controls
                                                        className="w-full"
                                                    />
                                                )}
                                                {m.fileType === 'document' && (
                                                    <div className="flex items-center gap-2 p-2 bg-white/20 rounded">
                                                        <File className="w-4 h-4" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{m.fileName}</p>
                                                            <p className="text-xs opacity-70">{formatFileSize(m.fileSize)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                                {m.fileType === 'other' && (
                                                    <div className="flex items-center gap-2 p-2 bg-white/20 rounded">
                                                        <File className="w-4 h-4" />
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-medium truncate">{m.fileName}</p>
                                                            <p className="text-xs opacity-70">{formatFileSize(m.fileSize)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* Message text */}
                                        {m.text && (
                                            <p>
                                                {m.translatedText || m.text}
                                                {m.lang && (
                                                    <span className="ml-2 text-[10px] opacity-70">[{m.lang}]</span>
                                                )}
                                            </p>
                                        )}

                                        {/* Message actions for selected messages */}
                                        {selectedMessages.has(m._id) && (
                                            <div className="absolute top-0 right-0 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 p-2 z-10">
                                                <div className="flex flex-col gap-1">
                                                    {/* Only show Translate button for messages with meaningful text content */}
                                                    {m.text && typeof m.text === 'string' && m.text.trim().length > 0 && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedMessageForTranslation(m);
                                                            }}
                                                            disabled={isTranslatingMessage}
                                                            className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded hover:bg-blue-200 dark:hover:bg-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                        >
                                                            {isTranslatingMessage ? (
                                                                <>
                                                                    <div className="w-3 h-3 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
                                                                    Translating...
                                                                </>
                                                            ) : (
                                                                'Translate'
                                                            )}
                                                        </button>
                                                    )}
                                                    {/* Only show Delete button for user's own messages */}
                                                    {m.sender._id === user.id && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedMessageForDeletion(m);
                                                            }}
                                                            disabled={isDeletingMessage}
                                                            className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded hover:bg-red-200 dark:hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                                                        >
                                                            {isDeletingMessage ? (
                                                                <>
                                                                    <div className="w-3 h-3 border-2 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
                                                                    Deleting...
                                                                </>
                                                            ) : (
                                                                'Delete'
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {m.sender._id === user.id && (
                                        <span className="text-[10px] text-gray-400 mr-2">
                                            {Array.isArray(m.seenBy) && otherUserId && m.seenBy.some((s) => (s?._id || s) === otherUserId)
                                                ? "Seen"
                                                : "Sent"}
                                        </span>
                                    )}
                                </div>
                            ))}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <form
                            onSubmit={(e) => { e.preventDefault(); sendMessage(); }}
                            className="p-4 lg:p-6 border-t dark:border-gray-700 bg-gradient-to-r from-white to-blue-50 dark:from-gray-900 dark:to-blue-900/20 flex gap-2 lg:gap-3"
                        >
                            {/* File upload button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-2 lg:p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 hover:scale-110"
                                disabled={isUploading}
                                title="Attach file"
                            >
                                {isUploading ? (
                                    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                                ) : (
                                    <File className="w-5 h-5" />
                                )}
                            </button>

                            {/* Hidden file input */}
                            <input
                                ref={fileInputRef}
                                type="file"
                                onChange={handleFileSelect}
                                className="hidden"
                                accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                            />

                            {/* Selected file preview */}
                            {selectedFile && (
                                <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                                    <File className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-32">
                                        {selectedFile.fileName}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={removeSelectedFile}
                                        className="text-red-500 hover:text-red-700 text-lg font-bold"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <input
                                type="text"
                                value={newMsg}
                                onChange={(e) => {
                                    setNewMsg(e.target.value);
                                }}
                                placeholder="Type a message..."
                                className="flex-1 border dark:border-gray-600 rounded-full px-4 lg:px-6 py-2 lg:py-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition-all duration-200 shadow-sm hover:shadow-md text-sm lg:text-base"
                            />
                            <button
                                type="submit"
                                className="bg-gradient-to-r from-blue-500 to-purple-600 text-white px-4 lg:px-6 py-2 lg:py-3 rounded-full hover:from-blue-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105 text-sm lg:text-base"
                                disabled={(!newMsg.trim() && !selectedFile)}
                            >
                                Send
                            </button>
                        </form>
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
                        Select a conversation to start chatting.
                    </div>
                )}
            </div>
            {/* Translation Modal */}
            {selectedMessageForTranslation && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 dark:text-white">Translate Message</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            &quot;{selectedMessageForTranslation.text}&quot;
                        </p>
                        <div className="space-y-3">
                            <select
                                onChange={(e) => {
                                    if (e.target.value) {
                                        translateSelectedMessage(selectedMessageForTranslation._id, e.target.value);
                                        setSelectedMessageForTranslation(null);
                                    }
                                }}
                                className="w-full p-2 border dark:border-gray-600 rounded bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white"
                            >
                                <option value="">Select language...</option>
                                <option value="en">English</option>
                                <option value="hi">Hindi</option>
                                <option value="es">Spanish</option>
                                <option value="fr">French</option>
                                <option value="de">German</option>
                                <option value="ja">Japanese</option>
                                <option value="ko">Korean</option>
                                <option value="zh">Chinese</option>
                                <option value="ar">Arabic</option>
                            </select>
                        </div>
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setSelectedMessageForTranslation(null)}
                                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {selectedMessageForDeletion && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
                        <h3 className="text-lg font-semibold mb-4 dark:text-white text-red-600">Delete Message</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                            Are you sure you want to delete this message? This action cannot be undone.
                        </p>
                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => setSelectedMessageForDeletion(null)}
                                className="flex-1 px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    deleteMessage(selectedMessageForDeletion._id);
                                }}
                                className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Incoming Call Modal - Only show when not making outgoing call */}
            {showCallModal && incomingCall && !isOutgoingCall && (
                <>
                    {console.log("📞 ChatPage: Rendering incoming call modal with:", incomingCall)}
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
                </>
            )}


        </div>


    );
}
