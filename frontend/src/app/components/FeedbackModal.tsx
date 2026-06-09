"use client";

import React, { useState } from "react";

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: (rating?: number, comment?: string) => void;
  featureName: string;
}

export default function FeedbackModal({ isOpen, onClose, featureName }: FeedbackModalProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState<string>("");

  if (!isOpen) return null;

  const handleSubmit = () => {
    if (rating === 0) return;
    onClose(rating, comment);
  };

  const handleSkip = () => {
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 animate-fade-in backdrop-blur-[2px]">
      <div className="bg-white rounded-[32px] w-full max-w-[320px] p-6 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
        {/* Star Icon */}
        <div className="w-12 h-12 rounded-full bg-amber-50 flex items-center justify-center mb-3 text-2xl">
          ⭐
        </div>
        
        {/* Title */}
        <h3 className="text-sm font-black text-slate-800 mb-1 leading-snug">
          Đánh giá độ hữu ích
        </h3>
        <p className="text-[11px] text-slate-400 font-bold mb-4 uppercase tracking-wider">
          Tính năng: &ldquo;{featureName}&rdquo;
        </p>

        {/* Stars */}
        <div className="flex items-center gap-2 mb-4">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              className="text-3xl transition-transform active:scale-90"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
            >
              <span className={(hoveredRating || rating) >= star ? "text-amber-400" : "text-slate-200"}>
                ★
              </span>
            </button>
          ))}
        </div>

        {/* Optional Comments */}
        <textarea
          className="w-full bg-slate-50 border border-slate-150 rounded-2xl p-3 text-[11px] font-semibold text-slate-700 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 transition-colors resize-none h-16 mb-5"
          placeholder="Ý kiến đóng góp khác (không bắt buộc)..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
        />

        {/* Action Buttons */}
        <div className="flex flex-col gap-1.5 w-full">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={rating === 0}
            className={`w-full py-2.5 rounded-full font-black text-xs transition-all ${
              rating === 0
                ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-md shadow-emerald-500/10 active:scale-[0.98]"
            }`}
          >
            Gửi đánh giá
          </button>
          
          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-2 rounded-full font-bold text-xs text-slate-400 hover:bg-slate-50 transition-colors active:scale-[0.98]"
          >
            Bỏ qua
          </button>
        </div>
      </div>
    </div>
  );
}
