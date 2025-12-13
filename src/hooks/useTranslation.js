import { useEffect, useRef, useState } from "react";
import axios from "axios";

export function useTranslation(selectedConv, messages, setMessages) {
  const [recvLang, setRecvLang] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const recvLangRef = useRef("");
  const translateCacheRef = useRef(new Map());
  const messagesRef = useRef(messages);
  const selectedConvRef = useRef(selectedConv);

  // Keep refs updated
  useEffect(() => {
    recvLangRef.current = recvLang;
  }, [recvLang]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    selectedConvRef.current = selectedConv;
  }, [selectedConv]);

  // Translate messages when target language changes
  useEffect(() => {
    const currentSelectedConv = selectedConvRef.current;
    if (!currentSelectedConv) return;
    
    const target = recvLangRef.current;
    if (!target) {
      setMessages((prev) => {
        // Only update if there are messages with translatedText
        const hasTranslated = prev.some(m => m.translatedText !== undefined);
        if (!hasTranslated) return prev; // No change needed
        return prev.map((m) => ({ ...m, translatedText: undefined }));
      });
      return;
    }
    
    let cancelled = false;
    setIsTranslating(true);
    (async () => {
      const msgs = (messagesRef.current || []).slice(-50);
      const cache = translateCacheRef.current;
      const jobs = [];
      for (const m of msgs) {
        const source = m.lang || "auto";
        if (target === source) continue;
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

      const concurrency = 4;
      for (let i = 0; i < jobs.length; i += concurrency) {
        if (cancelled) break;
        await Promise.all(jobs.slice(i, i + concurrency).map((fn) => fn()));
      }

      if (cancelled) return;
      setMessages((prev) => {
        const targetLang = recvLangRef.current;
        if (!targetLang) return prev;
        return prev.map((m) => {
          const key = `${m._id}:${targetLang}`;
          const translated = cache.get(key);
          // Only update if translation actually changed
          if (m.translatedText === translated) return m;
          return { ...m, translatedText: translated };
        });
      });
      setIsTranslating(false);
    })();
    return () => { cancelled = true; setIsTranslating(false); };
  }, [recvLang, selectedConv]); // Removed messages and setMessages from deps

  // Reset translation when switching conversations
  useEffect(() => {
    if (!selectedConv) return;
    setRecvLang("");
    recvLangRef.current = "";
    setMessages((prev) => {
      const hasTranslated = prev.some(m => m.translatedText !== undefined);
      if (!hasTranslated) return prev; // No change needed
      return prev.map((m) => ({ ...m, translatedText: undefined }));
    });
  }, [selectedConv]); // Removed setMessages from deps

  const translateMessage = async (message, targetLang) => {
    const source = message.lang || "auto";
    if (targetLang === source) return message.text;

    const key = `${message._id}:${targetLang}`;
    const cache = translateCacheRef.current;
    
    if (cache.has(key)) {
      return cache.get(key);
    }

    try {
      const resp = await axios.post('/api/translate', {
        q: message.text,
        source,
        target: targetLang
      });
      const translated = resp.data?.translatedText || message.text;
      cache.set(key, translated);
      return translated;
    } catch (_) {
      return message.text;
    }
  };

  return {
    recvLang,
    setRecvLang,
    isTranslating,
    recvLangRef,
    translateMessage,
    translateCacheRef
  };
}

