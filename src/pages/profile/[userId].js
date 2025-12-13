"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { ArrowLeft, Mail, Calendar } from "lucide-react";

export default function ProfilePage() {
  const router = useRouter();
  const { userId } = router.query;
  const [user, setUser] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem("user");
    if (!stored) {
      router.push("/");
      return;
    }
    const parsed = JSON.parse(stored);
    setCurrentUser(parsed);

    const storedDark = localStorage.getItem("darkMode");
    if (storedDark) setDark(JSON.parse(storedDark));
  }, [router]);

  useEffect(() => {
    if (!userId || !currentUser) return;

    // If viewing own profile, use current user data
    if (userId === currentUser.id) {
      setUser(currentUser);
      setLoading(false);
      return;
    }

    // Fetch other user's profile
    axios
      .get(`/api/users/${userId}`)
      .then((res) => {
        setUser(res.data);
        setLoading(false);
      })
      .catch((err) => {
        setLoading(false);
      });
  }, [userId, currentUser]);

  if (loading) {
    return (
      <div className={`${dark ? "dark" : ""} min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className={`${dark ? "dark" : ""} min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400 mb-4">User not found</p>
          <button
            onClick={() => router.push("/chat")}
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Back to Chat
          </button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === user._id || currentUser?.id === user.id;

  return (
    <div className={`${dark ? "dark" : ""} min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900`}>
      <div className="max-w-4xl mx-auto p-4 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <button
            onClick={() => router.push("/chat")}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>Back to Chat</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile</h1>
        </div>

        {/* Profile Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 lg:p-8">
          {/* Avatar and Name */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-32 h-32 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-4xl shadow-lg mb-4">
              {user.name?.[0]?.toUpperCase() || "?"}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{user.name || "Unknown User"}</h2>
            {isOwnProfile && (
              <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium">
                You
              </span>
            )}
          </div>

          {/* User Details */}
          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
              <Mail className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Email</p>
                <p className="text-gray-900 dark:text-white font-medium break-all">{user.email || "Not provided"}</p>
              </div>
            </div>

            {user.createdAt && (
              <div className="flex items-start gap-4 p-4 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Member Since</p>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {new Date(user.createdAt).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          {!isOwnProfile && (
            <div className="mt-8 pt-8 border-t dark:border-gray-700">
              <button
                onClick={() => router.push(`/chat?userId=${user._id || user.id}`)}
                className="w-full px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-lg font-medium shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-105"
              >
                Send Message
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

