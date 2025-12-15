import { useState, useEffect } from "react";
import axios from "axios";
import { useRouter } from "next/router";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [dark, setDark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // If already logged in, go straight to chat
  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    if (stored) {
      router.replace("/chat");
    }
  }, [router]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await axios.post("/api/auth/login", { email, password });
      localStorage.setItem("user", JSON.stringify(res.data));
      router.push("/chat");
    } catch (err) {
      setError(err.response?.data?.error || "Login failed");
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`${dark ? "dark" : ""} relative flex items-center justify-center min-h-screen overflow-hidden bg-gradient-to-br from-white via-blue-50/30 to-blue-100/40 dark:from-gray-950 dark:via-gray-900 dark:to-gray-900 p-4`}
    >
      {/* Soft decorative blobs */}
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-20 -left-10 w-72 h-72 bg-blue-300/25 dark:bg-blue-500/15 blur-3xl rounded-full" />
        <div className="absolute top-10 right-0 w-80 h-80 bg-indigo-300/20 dark:bg-indigo-500/15 blur-3xl rounded-full" />
        <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-300/20 dark:bg-cyan-500/15 blur-3xl rounded-full" />
      </div>
      {/* Full-page subtle radial glow and texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: `
            radial-gradient(800px at 20% 20%, rgba(99, 102, 241, 0.10), transparent 50%),
            radial-gradient(900px at 80% 10%, rgba(14, 165, 233, 0.10), transparent 55%),
            radial-gradient(700px at 50% 80%, rgba(59, 130, 246, 0.10), transparent 50%)
          `
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-soft-light"
        style={{
          backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.6) 1px, transparent 0)",
          backgroundSize: "24px 24px"
        }}
      />
      <form
        onSubmit={handleLogin}
        className="relative z-10 bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl p-8 lg:p-10 rounded-3xl shadow-xl w-full max-w-md flex flex-col gap-6 border border-gray-100 dark:border-gray-800"
      >
        <h2 className="text-3xl font-bold text-center dark:text-white">Login</h2>

        {error && (
          <p className="text-red-500 text-sm text-center">{error}</p>
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-6 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="px-6 py-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 shadow-sm hover:shadow-md"
        />

        <button
          type="submit"
          disabled={isLoading}
          className="bg-gradient-to-r from-blue-500 to-blue-600 text-white py-4 rounded-xl hover:from-blue-600 hover:to-blue-700 font-semibold shadow-md hover:shadow-lg transition-all duration-200 transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              Logging in...
            </>
          ) : (
            "Login"
          )}
        </button>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400">
          Don&apos;t have an account?{" "}
          <span
            className="text-blue-600 dark:text-blue-400 cursor-pointer hover:underline font-semibold"
            onClick={() => router.push("/signup")}
          >
            Sign up
          </span>
        </p>

        <button
          type="button"
          className="mt-4 p-3 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 flex items-center justify-center gap-2"
          onClick={() => setDark(!dark)}
        >
          {dark ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Light Mode
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
              </svg>
              Dark Mode
            </>
          )}
        </button>
      </form>
    </div>
  );
}
