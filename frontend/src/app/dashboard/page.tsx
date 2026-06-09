"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import NavBar from "../components/NavBar";
import { useAuth } from "@/contexts/AuthContext";
import posthog from "posthog-js";
import FeedbackModal from "../components/FeedbackModal";

interface PronunciationError {
  word: string;
  count: number;
  ipa: string;
  desc: string;
  errorPart: string;
}

interface StudyDayData {
  label: string;
  mins: number;
  active: boolean;
}

function DashboardContent({ dataset }: { dataset: string }) {
  const router = useRouter();
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";

  const [childName, setChildName] = useState("Sunny");
  const [isBottomSheetOpen, setIsBottomSheetOpen] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(2); // Thứ Tư (Hôm nay) làm mặc định
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const handleNavigateToMemory = () => {
    const feedbackSubmitted = localStorage.getItem("has_given_usefulness_feedback");
    if (!feedbackSubmitted) {
      setIsFeedbackOpen(true);
    } else {
      router.push(`/memory?dataset=${dataset}`);
    }
  };

  const handleFeedbackClose = (rating?: number, comment?: string) => {
    setIsFeedbackOpen(false);
    localStorage.setItem("has_given_usefulness_feedback", "true");
    
    if (rating) {
      // Capture feedback in PostHog
      posthog.capture("feature_usefulness_rated", {
        feature: "Xem Cụm Ký ức",
        rating,
        comment,
        from_page: "/dashboard",
        to_page: "/memory",
        dataset,
      });
    }
    
    router.push(`/memory?dataset=${dataset}`);
  };

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/reasoning/layers?dataset=${dataset}`);
        if (res.ok) {
          const data = await res.json();
          if (data.child_profile?.name) {
            setChildName(data.child_profile.name);
          }
        }
      } catch (err) {
        console.error("Error loading profile:", err);
      }
    };
    fetchProfile();
  }, [dataset, API_BASE]);

  // Mock data cho streak 7 ngày (Thứ 2 - Chủ nhật)
  const studyDays: StudyDayData[] = [
    { label: "T2", mins: 10, active: true },
    { label: "T3", mins: 18, active: true },
    { label: "T4", mins: 25, active: true }, // Hôm nay
    { label: "T5", mins: 0, active: false },
    { label: "T6", mins: 12, active: true },
    { label: "T7", mins: 0, active: false },
    { label: "CN", mins: 8, active: true },
  ];

  const maxMins = 30; // Để tính tỉ lệ cột biểu đồ

  // Mock phát âm sửa lỗi hôm nay
  const pronunciationErrors: PronunciationError[] = [
    {
      word: "birthday",
      count: 3,
      ipa: "/ˈbɜːrθ.deɪ/",
      desc: "Âm /θ/ phát thành /t/ — \"birtday\"",
      errorPart: "th",
    },
    {
      word: "purple",
      count: 2,
      ipa: "/ˈpɜːr.pl/",
      desc: "Âm /ɜːr/ chưa tròn, gần giống \"poh-ple\"",
      errorPart: "ur",
    },
    {
      word: "stripe",
      count: 1,
      ipa: "/straɪp/",
      desc: "Cụm /str/ bỏ âm /r/, phát thành \"stipe\"",
      errorPart: "str",
    },
  ];

  // Mock từ vựng và mẫu câu hôm nay
  const learnedWords = ["rainbow", "purple", "polka dots", "stripe", "pattern"];
  const learnedSentence = "I have a green shirt.";

  return (
    <div className="flex-1 flex flex-col h-full bg-[#F8FAFC] relative overflow-hidden">
      {/* Viewport content */}
      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-24">
        
        {/* Header Section */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none">
              Báo cáo học tập
            </h1>
            <p className="text-[11px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
              Phân tích ngày của {childName}
            </p>
          </div>
          <div className="flex items-center gap-1.5 bg-white border border-slate-100 shadow-sm rounded-full py-1 px-3">
            <span className="text-[10px] font-black text-[#2DB94D]">ACTIVE</span>
            <div className="w-2 h-2 rounded-full bg-[#2DB94D] animate-pulse" />
          </div>
        </div>

        {/* Day Switcher Component */}
        <div className="flex items-center justify-between bg-white border border-slate-100 rounded-2xl p-2.5 shadow-sm mb-5">
          <button 
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all text-sm font-bold"
            onClick={() => setSelectedDayIndex((prev) => (prev > 0 ? prev - 1 : prev))}
            disabled={selectedDayIndex === 0}
          >
            &lt;
          </button>
          <div className="text-center">
            <div className="text-[12px] font-black text-slate-700 uppercase tracking-wide">
              {selectedDayIndex === 2 ? "HÔM NAY" : `Thứ ${selectedDayIndex + 2 === 8 ? "nhật" : selectedDayIndex + 2}`}
            </div>
            <div className="text-[10px] text-slate-400 font-medium">
              28 tháng 5, 2026
            </div>
          </div>
          <button 
            className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-50 active:scale-95 transition-all text-sm font-bold"
            onClick={() => setSelectedDayIndex((prev) => (prev < 6 ? prev + 1 : prev))}
            disabled={selectedDayIndex === 6}
          >
            &gt;
          </button>
        </div>

        {/* 2 Stat Cards (Horizontal Layout) */}
        <div className="grid grid-cols-2 gap-3.5 mb-5">
          {/* Card 1: Thời gian học hôm nay */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">⏱️</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Học bài</span>
              </div>
              <div className="text-[22px] font-black text-slate-800 tracking-tight leading-none mb-1">
                25 <span className="text-xs font-bold text-slate-400">phút</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">
                Tổng lượng học hôm nay
              </p>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-50 flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500">Học: 15m</span>
                <span className="text-[9px] font-bold text-slate-400">Chat: 10m</span>
              </div>
              <span className="text-[10px] text-[#2DB94D] font-extrabold bg-[#2DB94D]/10 px-1.5 py-0.5 rounded-md">
                60%
              </span>
            </div>
          </div>

          {/* Card 2: Thời gian nói / phản xạ */}
          <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-lg">🎙️</span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Phản xạ</span>
              </div>
              <div className="text-[22px] font-black text-slate-800 tracking-tight leading-none mb-1">
                +5 <span className="text-xs font-bold text-slate-400">phút</span>
              </div>
              <p className="text-[10px] text-slate-400 font-medium leading-tight">
                Thời lượng nói tích lũy
              </p>
            </div>
            <div className="mt-4 pt-3.5 border-t border-slate-50 flex flex-col">
              <div className="flex items-center justify-between">
                <span className="text-[9px] font-bold text-slate-500">Tỉ lệ nói/học</span>
                <span className="text-[9px] font-black text-emerald-600">20%</span>
              </div>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-1.5 overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-full" style={{ width: "20%" }} />
              </div>
            </div>
          </div>
        </div>

        {/* Streak Calendar 7 days */}
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-3.5">
            <div className="flex items-center gap-2">
              <span className="text-base">🔥</span>
              <span className="text-xs font-black text-slate-700">Chuỗi 4 ngày liên tiếp</span>
            </div>
            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-full px-2 py-0.5">
              ĐẠT MỤC TIÊU
            </span>
          </div>

          {/* Bar Chart 7 Days */}
          <div className="flex items-end justify-between h-14 px-2 gap-2">
            {studyDays.map((day, idx) => {
              const heightPct = day.mins === 0 ? 4 : Math.min(100, (day.mins / maxMins) * 100);
              const isToday = idx === selectedDayIndex;
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="text-[8px] font-bold text-slate-400 h-3">
                    {day.mins > 0 ? `${day.mins}m` : ""}
                  </div>
                  <div className="w-full relative h-10 flex items-end justify-center">
                    <div 
                      className={`w-full rounded-t-md transition-all duration-300 ${
                        day.mins === 0 
                          ? "bg-slate-100 h-[4px]" 
                          : isToday 
                            ? "bg-gradient-to-t from-[#2DB94D] to-[#4ADE80] shadow-[0_2px_8px_rgba(45,185,77,0.3)] h-full" 
                            : "bg-slate-200"
                      }`}
                      style={{ height: day.mins > 0 ? `${heightPct}%` : "4px" }}
                    />
                  </div>
                  <span className={`text-[9px] font-black ${isToday ? "text-[#2DB94D]" : "text-slate-400"}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pika sửa phát âm (IPA table) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-base">🎯</span>
              <span className="text-xs font-black text-slate-700">Pika sửa phát âm hôm nay</span>
            </div>
            <span className="text-[9.5px] font-extrabold text-rose-500 bg-rose-50 px-2 py-0.5 rounded-md">
              3 từ sửa lỗi
            </span>
          </div>

          <div className="flex flex-col gap-3">
            {pronunciationErrors.map((err, idx) => (
              <div key={idx} className="flex flex-col bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1">
                    <span className="text-[12px] font-black text-slate-800">
                      &quot;
                      <span className="text-rose-500 underline decoration-rose-400 decoration-2 underline-offset-2">
                        {err.word.substring(0, err.word.indexOf(err.errorPart))}
                        {err.errorPart}
                      </span>
                      {err.word.substring(err.word.indexOf(err.errorPart) + err.errorPart.length)}
                      &quot;
                    </span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      {err.ipa}
                    </span>
                  </div>
                  <span className="text-[9px] font-bold text-slate-400 bg-white border border-slate-100 rounded-md px-1.5 py-0.5">
                    {err.count} lần
                  </span>
                </div>
                <div className="text-[10.5px] text-slate-500 font-semibold leading-relaxed">
                  💡 {err.desc}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Kiến thức thu nạp (Học gì hôm nay) */}
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm mb-5">
          <div className="flex items-center justify-between mb-3.5 pb-2.5 border-b border-slate-50">
            <div className="flex items-center gap-2">
              <span className="text-base">📚</span>
              <span className="text-xs font-black text-slate-700">Kiến thức thu nhận</span>
            </div>
            <span className="text-[9.5px] font-extrabold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
              Màu sắc
            </span>
          </div>

          {/* Words */}
          <div className="mb-4">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Từ vựng đã luyện
            </span>
            <div className="flex flex-wrap gap-1.5">
              {learnedWords.map((word, idx) => (
                <span 
                  key={idx} 
                  className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200/50 rounded-xl px-2.5 py-1"
                >
                  {word}
                </span>
              ))}
            </div>
          </div>

          {/* Phrases */}
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Mẫu câu tự nói được
            </span>
            <div className="bg-emerald-50/50 border border-emerald-100 rounded-2xl p-3 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-8 h-8 bg-emerald-100/30 rounded-bl-full flex items-center justify-center font-bold text-emerald-600 text-xs">
                ✓
              </div>
              <p className="text-[12px] font-black text-slate-800 mb-0.5">
                &ldquo;{learnedSentence}&rdquo;
              </p>
              <span className="text-[9.5px] text-emerald-600 font-extrabold">
                ✨ {childName} tự nói được với Pika
              </span>
            </div>
          </div>
        </div>

        {/* Nudge Banner for Bottom Sheet */}
        <button 
          onClick={() => setIsBottomSheetOpen(true)}
          className="w-full text-left bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white rounded-3xl p-4 shadow-[0_4px_16px_rgba(16,185,129,0.15)] flex items-center justify-between active:scale-[0.99] transition-all mb-5"
        >
          <div className="flex-1 pr-4">
            <div className="text-[12px] font-black uppercase tracking-wider text-emerald-100 mb-0.5">
              💡 Gợi ý ôn tập tối nay
            </div>
            <div className="text-[11px] font-bold text-white leading-snug">
              Bố mẹ đồng hành cùng con ôn tập từ vựng & mẫu câu (~5 phút)
            </div>
          </div>
          <span className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg">
            &gt;
          </span>
        </button>

        {/* Cụm ký ức & Phát triển — CTA at bottom of page */}
        <div className="bg-white border border-slate-100 rounded-3xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex items-start gap-3">
            <span className="text-2xl mt-0.5">🧠</span>
            <div className="flex-1">
              <h4 className="text-xs font-black text-slate-800">Cụm ký ức &amp; Phát triển</h4>
              <p className="text-[10.5px] text-slate-400 font-semibold leading-normal mt-0.5">
                Xem chi tiết các cụm ký ức thu nhận và xu hướng phát triển tuần của con.
              </p>
            </div>
          </div>
          <button
            onClick={handleNavigateToMemory}
            className="mt-3.5 w-full bg-[#2DB94D] hover:bg-[#259E3F] text-white text-[11px] font-black py-2 rounded-2xl shadow-sm shadow-[#2DB94D]/10 active:scale-[0.98] transition-all flex items-center justify-center gap-1"
          >
            Xem cụm ký ức &amp; phát triển <span className="text-[10px]">➔</span>
          </button>
        </div>

      </div>

      {/* Slide-up Bottom Sheet */}
      {/* Overlay */}
      <div 
        className={`absolute inset-0 bg-black/40 z-30 transition-opacity duration-300 ${
          isBottomSheetOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setIsBottomSheetOpen(false)}
      />

      {/* Sheet panel */}
      <div 
        className={`absolute bottom-0 left-0 right-0 bg-white rounded-t-[32px] z-40 max-h-[80%] overflow-y-auto shadow-[0_-8px_30px_rgb(0,0,0,0.12)] transition-transform duration-300 ease-out transform ${
          isBottomSheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
      >
        {/* Handle */}
        <div className="w-12 h-1 bg-slate-200 rounded-full mx-auto my-3" />

        {/* Sheet Header */}
        <div className="px-5 pb-3 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-black text-slate-800">
              Gợi ý ôn tập cùng con
            </h3>
            <p className="text-[10px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">
              Bài hôm nay: Màu sắc & Trang phục
            </p>
          </div>
          <button 
            onClick={() => setIsBottomSheetOpen(false)}
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs active:scale-90 transition-all"
          >
            ✕
          </button>
        </div>

        {/* Sheet Body */}
        <div className="p-5 flex flex-col gap-4">
          <div className="bg-slate-50 rounded-2xl p-3 border border-slate-100 text-[10.5px] text-slate-500 font-bold">
            Sunny tự nói được câu: <span className="text-slate-700 italic font-black">&ldquo;I have a green shirt.&rdquo;</span>
          </div>

          {/* Step 1 */}
          <div className="border border-slate-100 rounded-2xl p-3.5 bg-white shadow-sm">
            <span className="inline-block text-[8px] font-black tracking-wider text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded mb-2 uppercase">
              Bước 1: Ôn từ vựng
            </span>
            <h4 className="text-[12px] font-black text-slate-850 mb-1.5 leading-snug">
              Chỉ vào áo con hỏi: <span className="text-emerald-600 italic">&ldquo;What color is this?&rdquo;</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Con vừa học rainbow, purple, stripe — dùng ngay với đồ vật thật để từ đi vào trí nhớ dài hạn.
            </p>
            <div className="text-[9.5px] text-slate-400 italic mt-1.5 font-bold">
              💡 Gợi ý trả lời: &quot;red / blue / striped / polka dots...&quot;
            </div>
          </div>

          {/* Step 2 */}
          <div className="border border-slate-100 rounded-2xl p-3.5 bg-white shadow-sm">
            <span className="inline-block text-[8px] font-black tracking-wider text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded mb-2 uppercase">
              Bước 2: Ôn mẫu câu
            </span>
            <h4 className="text-[12px] font-black text-slate-850 mb-1.5 leading-snug">
              Đố con hoàn thành: <span className="text-emerald-600 italic">&ldquo;I have a ___ shirt.&rdquo;</span>
            </h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Mẫu câu &ldquo;I have a ___&rdquo; con vừa luyện với Pika — thử áp dụng với áo, quần, giày, túi.
            </p>
          </div>

          {/* Step 3 */}
          <div className="border border-slate-100 rounded-2xl p-3.5 bg-white shadow-sm">
            <span className="inline-block text-[8px] font-black tracking-wider text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded mb-2 uppercase">
              Bước 3: Cùng con giao tiếp
            </span>
            <h4 className="text-[12px] font-black text-slate-850 mb-1.5 leading-snug">
              Trước khi đi ngủ, cùng con chọn quần áo ngày mai bằng tiếng Anh
            </h4>
            <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
              Từ &quot;biết&quot; &rarr; &quot;dùng được&quot; cần ngữ cảnh thực tế — chọn đồ mặc là cơ hội hoàn hảo và không áp lực.
            </p>
          </div>

          <div className="text-center text-[10px] text-slate-400 font-bold py-2">
            ⏱️ ~5 phút · không cần bố mẹ biết tiếng Anh giỏi
          </div>
        </div>
      </div>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={handleFeedbackClose}
        featureName="Báo cáo học tập hôm nay"
      />
    </div>
  );
}

function DashboardPageInner() {
  const searchParams = useSearchParams();
  const { profileId } = useAuth();
  const dataset = searchParams.get("dataset") || profileId || "019dfd3e-282c-76b9-a760-b9cf3cd22212";

  return (
    <div className="min-h-screen bg-[#F5F6F8] text-slate-800 font-sans flex flex-col items-center justify-center p-0 md:p-6 overflow-x-hidden selection:bg-[#2DB94D]/20 selection:text-[#1A9E3A]">
      {/* Background glows */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-20%] w-[60%] h-[60%] rounded-full bg-[#2DB94D]/4 blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-20%] w-[60%] h-[60%] rounded-full bg-[#FF9500]/3 blur-[160px]" />
      </div>

      {/* Main Mobile Frame */}
      <div className="w-full max-w-[390px] h-[844px] bg-[#F5F6F8] rounded-none md:rounded-[48px] border-none md:border-[10px] border-slate-200/90 shadow-[0_20px_50px_rgba(0,0,0,0.06)] flex flex-col overflow-hidden relative z-10">
        {/* Status bar */}
        <div className="h-10 bg-white shrink-0 flex items-center justify-between px-6 z-20 text-[11px] font-extrabold text-slate-600 font-mono pointer-events-none border-b border-slate-100 relative">
          <span>9:41</span>
          <div className="w-24 h-4.5 bg-[#000] rounded-full absolute left-1/2 -translate-x-1/2 top-2 border border-slate-800/50" />
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-4.5 h-2.5 border border-slate-400 rounded-[3px] p-[1px] flex items-center">
              <div className="w-full h-full bg-slate-600 rounded-[1px]" />
            </div>
          </div>
        </div>

        {/* Content with Suspense */}
        <Suspense fallback={
          <div className="flex-1 flex items-center justify-center bg-[#F5F6F8]">
            <div className="w-6 h-6 border-2 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
          </div>
        }>
          <DashboardContent dataset={dataset} />
        </Suspense>

        {/* NavBar Component */}
        <NavBar dataset={dataset} />

        {/* Home indicator */}
        <div className="h-4 bg-white shrink-0 flex items-center justify-center pb-2 z-20 pointer-events-none">
          <div className="w-32 h-1 bg-black/15 rounded-full" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#F5F6F8]">
        <div className="w-8 h-8 border-4 border-[#2DB94D] border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  );
}
