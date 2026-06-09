"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoClicks, setLogoClicks] = useState(0);
  const [showDevMode, setShowDevMode] = useState(false);
  const [devProfileId, setDevProfileId] = useState("");
  const { login, loginWithProfileId } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!/^0\d{9}$/.test(phone)) {
      setError("Số điện thoại không hợp lệ. Vui lòng nhập đúng 10 chữ số bắt đầu bằng 0.");
      return;
    }

    setIsSubmitting(true);

    try {
      await login(phone, password);
      // login handles the redirection to /schedule
    } catch (err) {
      setError("Số điện thoại hoặc mật khẩu không đúng. Vui lòng thử lại.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-1 flex-col items-center justify-center bg-[#F5F6F8] px-4 py-8">
      <div className="w-full max-w-md">
        {/* Logo / Brand */}
        <div className="mb-8 text-center">
          <div 
            onClick={() => {
              const clicks = logoClicks + 1;
              setLogoClicks(clicks);
              if (clicks >= 5) {
                setShowDevMode(true);
              }
            }}
            className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-500 shadow-lg sm:h-24 sm:w-24 cursor-pointer select-none active:scale-95 transition-all"
          >
            <span className="text-3xl sm:text-4xl text-white font-bold">P</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-800 sm:text-3xl">
            Pika
          </h1>
          <p className="mt-2 text-sm text-gray-500 sm:text-base">
            Cùng con học, cùng con lớn
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 sm:rounded-3xl sm:p-8">
          <h2 className="mb-6 text-center text-xl font-semibold text-gray-700 sm:text-2xl">
            Đăng nhập
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Phone */}
            <div>
              <label
                htmlFor="phone"
                className="mb-1.5 block text-sm font-medium text-gray-600"
              >
                Số điện thoại
              </label>
              <input
                id="phone"
                type="tel"
                inputMode="numeric"
                value={phone}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "");
                  if (value.length <= 10) setPhone(value);
                }}
                pattern="^0\d{9}$"
                maxLength={10}
                placeholder="Nhập số điện thoại"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:py-3.5"
              />
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-1.5 block text-sm font-medium text-gray-600"
              >
                Mật khẩu
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Nhập mật khẩu"
                required
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-base text-gray-800 placeholder-gray-400 outline-none transition-all focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 sm:py-3.5"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600 border border-red-100">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-blue-500 px-4 py-3 text-base font-semibold text-white shadow-sm transition-all hover:bg-blue-600 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:py-3.5 sm:text-lg"
            >
              {isSubmitting ? "Đang đăng nhập..." : "Đăng nhập"}
            </button>

            {/* Dev Mode - Bypass Login with Profile ID */}
            {showDevMode && (
              <div className="mt-4 p-4 border border-dashed border-amber-300 rounded-2xl bg-amber-50/70 text-left">
                <span className="text-[10px] font-black text-amber-700 block mb-1 uppercase tracking-wider">🛠️ DEV BYPASS MODE</span>
                <label className="block text-[10px] font-bold text-slate-500 mb-1.5">Nhập Profile ID của con:</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={devProfileId}
                    onChange={(e) => setDevProfileId(e.target.value.trim())}
                    placeholder="e.g. 019dfd3e-282c-76b9-a760-b9cf3cd22212"
                    className="flex-1 text-[11px] rounded-xl border border-amber-200 bg-white px-3 py-2 outline-none font-mono text-slate-700 shadow-inner"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      if (!devProfileId) return;
                      try {
                        setIsSubmitting(true);
                        await loginWithProfileId(devProfileId);
                      } catch (err) {
                        setError("Không thể đăng nhập giả lập bằng Profile ID này.");
                      } finally {
                        setIsSubmitting(false);
                      }
                    }}
                    disabled={isSubmitting}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] rounded-xl px-4 py-2 active:scale-95 transition-all disabled:opacity-50"
                  >
                    Bypass
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
