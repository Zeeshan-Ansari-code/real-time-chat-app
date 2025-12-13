import { useRef } from "react";
import axios from "axios";

export function useMessages(user, setMessages, recvLangRef, translateCacheRef, translatingCounterRef, setIsTranslating) {
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const sendMessage = async (newMsg, selectedFile, selectedConv, setNewMsg, setSelectedFile) => {
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

  const deleteMessage = async (messageId, selectedConv) => {
    if (!selectedConv || !user) return;

    try {
      await axios.delete(`/api/messages/${selectedConv}/${messageId}`, {
        data: { userId: user.id }
      });
      setMessages((prev) => prev.filter((m) => m._id !== messageId));
    } catch (error) {
      alert("Failed to delete message");
    }
  };

  const translateSelectedMessage = async (messageId, targetLang, messages, setMessages) => {
    try {
      setIsTranslating(true);
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
    } catch (error) {
      alert("Failed to translate message");
    } finally {
      setIsTranslating(false);
    }
  };

  return {
    messagesEndRef,
    messagesContainerRef,
    scrollToBottom,
    sendMessage,
    deleteMessage,
    translateSelectedMessage
  };
}

