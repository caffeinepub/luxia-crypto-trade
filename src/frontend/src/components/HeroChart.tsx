import { useEffect, useRef } from "react";

export default function HeroChart() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const tRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const prices = [
      67200, 66800, 67100, 67500, 67300, 67800, 68100, 67900, 68400, 68200,
      68600, 68900, 68700, 69100, 68800, 69300, 69600,
    ];

    function draw() {
      if (!ctx || !canvas) return;
      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      ctx.clearRect(0, 0, W, H);

      tRef.current += 0.008;
      const t = tRef.current;

      const pts = prices.map((p, i) => ({
        x: (i / (prices.length - 1)) * (W - 40) + 20,
        y:
          H -
          40 -
          ((p - 66500 + Math.sin(t + i * 0.3) * 150) / 3000) * (H - 80),
      }));

      // Gradient fill
      const grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, "rgba(242,193,78,0.25)");
      grad.addColorStop(1, "rgba(242,193,78,0.0)");

      ctx.beginPath();
      ctx.moveTo(pts[0].x, H - 40);
      for (const p of pts) ctx.lineTo(p.x, p.y);
      ctx.lineTo(pts[pts.length - 1].x, H - 40);
      ctx.closePath();
      ctx.fillStyle = grad;
      ctx.fill();

      // Line
      const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
      lineGrad.addColorStop(0, "#B88A2A");
      lineGrad.addColorStop(0.5, "#F2C14E");
      lineGrad.addColorStop(1, "#F1D38A");

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        const mx = (pts[i - 1].x + pts[i].x) / 2;
        const my = (pts[i - 1].y + pts[i].y) / 2;
        ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.strokeStyle = lineGrad;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = "round";
      ctx.stroke();

      // Glow dot
      const last = pts[pts.length - 1];
      ctx.beginPath();
      ctx.arc(last.x, last.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = "#F2C14E";
      ctx.fill();
      ctx.beginPath();
      ctx.arc(last.x, last.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(242,193,78,0.3)";
      ctx.fill();

      // Volume bars
      const barW = (W - 60) / prices.length - 3;
      for (let i = 0; i < prices.length; i++) {
        const vol = 15 + Math.abs(Math.sin(t * 0.5 + i)) * 20;
        ctx.fillStyle =
          i % 2 === 0 ? "rgba(46,212,122,0.3)" : "rgba(255,90,107,0.3)";
        ctx.fillRect(
          (i / (prices.length - 1)) * (W - 60) + 20,
          H - 40,
          barW,
          -vol,
        );
      }

      // Price labels
      ctx.fillStyle = "rgba(167,176,188,0.6)";
      ctx.font = "10px 'General Sans', sans-serif";
      ctx.fillText("$69,600", 5, 30);
      ctx.fillText("$66,800", 5, H - 50);

      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(animRef.current);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block" }}
    />
  );
}
