import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [showApp, setShowApp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Efek Animasi Constellation Net (Konversi dari JavaScript murni ke React)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: Particle[] = [];
    let particleCount = window.innerWidth < 768 ? 40 : 80;
    const connectionDistance = 140;
    let animationFrameId: number;

    let mouse = { x: null as number | null, y: null as number | null, radius: 150, clickActive: false, clickTimer: 0 };

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      particleCount = window.innerWidth < 768 ? 40 : 80;
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    class Particle {
      x: number;
      y: number;
      vx: number;
      vy: number;
      size: number;
      isGreen: boolean;

      constructor() {
        this.x = Math.random() * canvas!.width;
        this.y = Math.random() * canvas!.height;
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.size = Math.random() * 2 + 1;
        this.isGreen = Math.random() > 0.85;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (this.x < 0 || this.x > canvas!.width) this.vx *= -1;
        if (this.y < 0 || this.y > canvas!.height) this.vy *= -1;

        if (mouse.x !== null && mouse.y !== null) {
          let dx = this.x - mouse.x;
          let dy = this.y - mouse.y;
          let distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < mouse.radius) {
            let force = (mouse.radius - distance) / mouse.radius;
            let strength = mouse.clickActive ? force * 15 : force * 2;
            let angle = Math.atan2(dy, dx);

            this.x += Math.cos(angle) * strength;
            this.y += Math.sin(angle) * strength;
          }
        }
      }

      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = this.isGreen ? 'rgba(0, 230, 118, 0.6)' : 'rgba(0, 229, 255, 0.5)';
        ctx!.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const drawLines = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const alpha = (1 - (distance / connectionDistance)) * 0.12;
            ctx!.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);

      if (mouse.clickActive) {
        mouse.clickTimer--;
        if (mouse.clickTimer <= 0) {
          mouse.clickActive = false;
        }
      }

      drawLines();

      particles.forEach((p) => {
        p.update();
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    const handleMouseDown = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.clickActive = true;
      mouse.clickTimer = 18;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
        mouse.clickActive = true;
        mouse.clickTimer = 18;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart);

    init();
    animate();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('touchstart', handleTouchStart);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  // ---------------- PAGE SWITCH LOGIC ----------------
  
  // Opsi A: Tampilan Panel Aplikasi Pemrosesan Data
  if (showApp) {
    return (
      <div className="min-h-screen w-full bg-[#0a0f1d] text-[#f4f6fa] flex items-center justify-center p-6 relative font-sans">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,229,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.01)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none z-1"></div>
        
        <div className="relative z-10 w-full max-w-4xl bg-[#0d1527] border border-[rgba(0,229,255,0.15)] rounded p-8 shadow-2xl shadow-cyan-500/5">
          <button 
            onClick={() => setShowApp(false)}
            className="mb-6 text-xs uppercase tracking-widest text-[#7e8b9b] hover:text-[#00e5ff] transition"
          >
            ← Back to System Interface
          </button>
          
          {/* Taruh/Hubungkan Komponen Utama FastAPI Processing Dashboard Anda di Sini */}
          <h2 className="text-2xl font-bold tracking-tight mb-2 text-transparent bg-clip-text bg-gradient-to-r from-white to-[#a3b8cc]">
            MGS Data Analytics Dashboard
          </h2>
          <p className="text-[#7e8b9b] text-sm mb-6 font-mono">[STATUS: PIPELINE_READY // ENGINE: FASTAPI]</p>
          
          <textarea 
            className="w-full h-64 p-4 bg-[#0a0f1d] border border-[rgba(0,229,255,0.1)] rounded text-[#f4f6fa] font-mono text-sm focus:outline-none focus:border-[#00e5ff] transition resize-none"
            placeholder="Paste raw engineering datasets, standard tags, or failure event descriptions here..."
          />
          <button className="mt-4 px-8 py-3 bg-[#00e5ff] hover:bg-cyan-400 text-[#0a0f1d] text-xs font-bold uppercase tracking-wider rounded transition-all transform hover:-translate-y-0.5 shadow-lg shadow-cyan-500/20">
            Execute Core Solver
          </button>
        </div>
      </div>
    );
  }

  // Opsi B: Tampilan Landing Page Asli (Ditambah Tombol Eksplorasi Baru)
  return (
    <div className="min-h-screen w-full bg-[#0a0f1d] text-[#f4f6fa] flex items-center justify-center overflow-hidden relative font-sans select-none">
      
      {/* Background Blueprint Tech Grids */}
      <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,229,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,229,255,0.02)_1px,transparent_1px)] bg-[size:40px_40px] bg-center pointer-events-none z-1"></div>
      <div className="absolute top-[30%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-[rgba(0,229,255,0.06)] to-transparent pointer-events-none z-1"></div>
      <div className="absolute left-[15%] top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-[rgba(0,229,255,0.06)] to-transparent pointer-events-none z-1"></div>

      {/* Crosshairs HUD */}
      <div className="absolute w-[10px] h-[10px] border border-[rgba(0,229,255,0.15)] z-[3] pointer-events-none top-[15px] left-[15px] border-r-0 border-b-0"></div>
      <div className="absolute w-[10px] h-[10px] border border-[rgba(0,229,255,0.15)] z-[3] pointer-events-none top-[15px] right-[15px] border-l-0 border-b-0"></div>
      <div className="absolute w-[10px] h-[10px] border border-[rgba(0,229,255,0.15)] z-[3] pointer-events-none bottom-[15px] left-[15px] border-r-0 border-t-0"></div>
      <div className="absolute w-[10px] h-[10px] border border-[rgba(0,229,255,0.15)] z-[3] pointer-events-none bottom-[15px] right-[15px] border-l-0 border-t-0"></div>

      {/* Dynamic Constellation Net Canvas */}
      <canvas ref={canvasRef} id="constellation-canvas" className="absolute top-0 left-0 w-full h-full z-[2]"></canvas>

      {/* Engineering Data Telemetry HUD */}
      <div className="absolute font-mono text-[10px] text-[#7e8b9b] pointer-events-none z-[3] leading-relaxed top-[20px] left-[20px] text-left max-md:top-[15px] max-md:left-[15px] max-md:text-[8px]">
        SYS.LOC: [06°11'21"S // 106°49'44"E]<br />
        ASSET.EVAL: <span className="text-[#00e5ff] font-bold">VALID</span><br />
        RELIABILITY_IDX: <span className="text-[#00e676] font-bold">0.99942</span><br />
        MODEL.TYPE: PRED_ANOMALY
      </div>

      <div className="absolute font-mono text-[10px] text-[#7e8b9b] pointer-events-none z-[3] leading-relaxed bottom-[20px] left-[20px] text-left max-md:bottom-