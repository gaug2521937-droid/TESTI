"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./PlayerContext";

/**
 * Живой визуализатор звука — полоски прыгают выше/ниже под музыку.
 * Данные берутся из Web Audio AnalyserNode (реальный спектр),
 * а если анализатор недоступен — из синтезированной волны.
 */
export function Visualizer({
  bars = 48,
  height = 120,
  variant = "bars",
  color = "#6c5ce7",
  color2 = "#00d2ff",
  className = "",
}: {
  bars?: number;
  height?: number;
  variant?: "bars" | "mirror" | "line";
  color?: string;
  color2?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const smoothRef = useRef<number[]>([]);
  const { getSpectrum, isPlaying } = usePlayer();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const rect = canvas.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    if (smoothRef.current.length !== bars) {
      smoothRef.current = new Array(bars).fill(0);
    }

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);
      if (w === 0 || h === 0) return;

      const spectrum = getSpectrum(bars);
      const smooth = smoothRef.current;

      ctx.clearRect(0, 0, w, h);

      const gap = variant === "line" ? 0 : Math.max(1.5, w / bars / 5);
      const barW = (w - gap * (bars - 1)) / bars;

      const grad = ctx.createLinearGradient(0, h, 0, 0);
      grad.addColorStop(0, color);
      grad.addColorStop(0.55, color2);
      grad.addColorStop(1, "#e84393");

      if (variant === "line") {
        // Плавная волна
        ctx.beginPath();
        for (let i = 0; i < bars; i++) {
          const target = (spectrum[i] / 255) * h;
          smooth[i] += (target - smooth[i]) * 0.28;
          const x = (i / (bars - 1)) * w;
          const y = h - Math.max(2, smooth[i]);
          if (i === 0) ctx.moveTo(x, y);
          else {
            const px = ((i - 1) / (bars - 1)) * w;
            const py = h - Math.max(2, smooth[i - 1]);
            ctx.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
          }
        }
        ctx.strokeStyle = grad;
        ctx.lineWidth = 2.6;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";
        ctx.shadowBlur = 14;
        ctx.shadowColor = color;
        ctx.stroke();
        ctx.shadowBlur = 0;
        return;
      }

      for (let i = 0; i < bars; i++) {
        const target = (spectrum[i] / 255) * h * (variant === "mirror" ? 0.5 : 0.94);
        // Плавное падение — быстрее вверх, медленнее вниз (как в реальных эквалайзерах)
        const rate = target > smooth[i] ? 0.42 : 0.13;
        smooth[i] += (target - smooth[i]) * rate;

        const bh = Math.max(2.5, smooth[i]);
        const x = i * (barW + gap);
        const r = Math.min(barW / 2, 3);

        ctx.fillStyle = grad;
        ctx.shadowBlur = isPlaying ? 10 : 0;
        ctx.shadowColor = color;

        if (variant === "mirror") {
          const mid = h / 2;
          ctx.beginPath();
          ctx.roundRect(x, mid - bh, barW, bh, [r, r, 0, 0]);
          ctx.fill();
          ctx.globalAlpha = 0.38;
          ctx.beginPath();
          ctx.roundRect(x, mid, barW, bh, [0, 0, r, r]);
          ctx.fill();
          ctx.globalAlpha = 1;
        } else {
          ctx.beginPath();
          ctx.roundRect(x, h - bh, barW, bh, [r, r, 0, 0]);
          ctx.fill();
        }
        ctx.shadowBlur = 0;
      }
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [bars, getSpectrum, isPlaying, variant, color, color2]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ width: "100%", height, display: "block" }}
    />
  );
}
