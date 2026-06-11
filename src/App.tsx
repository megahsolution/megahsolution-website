import React, { useState, useEffect, useRef } from 'react';

function App() {
  const [showApp, setShowApp] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // --- STATE MANAGEMENT UNTUK PIPELINE FASTAPI ---
  const [inputData, setInputData] = useState('');
  const [outputResult, setOutputResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Efek Animasi Constellation Net
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let particles: any[] = [];
    let particleCount = window.innerWidth < 768 ? 40 : 80;
    const connectionDistance = 140;
    let animationFrameId: number;

    let mouse = { x: null as number | null, y: null as number | null, radius: 150, clickActive: false, clickTimer: 0 };

    const resizeCanvas = () => {
      if (!canvas) return;
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
        this.x = Math.random() * (canvas?.width || window.innerWidth);
        this.y = Math.random() * (canvas?.height || window.innerHeight);
        this.vx = (Math.random() - 0.5) * 0.35;
        this.vy = (Math.random() - 0.5) * 0.35;
        this.size = Math.random() * 2 + 1;
        this.isGreen = Math.random() > 0.85;
      }

      update() {
        this.x += this.vx;
        this.y += this.vy;

        if (canvas) {
          if (this.x < 0 || this.x > canvas.width) this.vx *= -1;
          if (this.y < 0 || this.y > canvas.height) this.vy *= -1;
        }

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
        if (!ctx) return;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.isGreen ? 'rgba(0, 230, 118, 0.6)' : 'rgba(0, 229, 255, 0.5)';
        ctx.fill();
      }
    }

    const init = () => {
      particles = [];
      for (let i = 0; i < particleCount; i++) {
        particles.push(new Particle());
      }
    };

    const drawLines = () => {
      if (!ctx) return;
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < connectionDistance) {
            const alpha = (1 - (distance / connectionDistance)) * 0.12;
            ctx.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas?.width || window.innerWidth, canvas?.height || window.innerHeight);

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

  // --- FUNGSI EKSEKUSI SOLVER (KONEKSI KE FASTAPI) ---
  const handleExecuteSolver = async () => {
    if (!inputData.trim()) {
      alert("Silakan masukkan datasets atau parameter data terlebih dahulu.");
      return;
    }

    setIsLoading(true);
    setOutputResult('');

    try {
      // Mengirimkan request POST ke endpoint FastAPI sesuai rules vercel.json
      const response = await fetch('/api/proses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ teks_mentah: inputData }),
      });

      const data = await response.json();

      if (response.ok && data.status === 'success') {
        setOutputResult(data.hasil);
      } else {
        setOutputResult(`[ERROR]: ${data.detail || 'Gagal memproses eksekusi kernel.'}`);
      }
    } catch (error: any) {
      setOutputResult(`[CONNECTION_FAILED]: Gagal terhubung ke modul FastAPI.\n${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // ---------------- CORE UI RENDERING (CSS STANDARD) ----------------

  // PANEL INTERFACE UTAMA APLIKASI DATA PROCESSING
  if (showApp) {
    return (
      <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#0a0f1d', color: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', position: 'relative', fontFamily: 'sans-serif' }}>
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '896px', backgroundColor: '#0d1527', border: '1px solid rgba(0, 229, 255, 0.15)', borderRadius: '4px', padding: '32px' }}>
          
          <button 
            onClick={() => {
              setShowApp(false);
              setInputData('');
              setOutputResult('');
            }}
            style={{ background: 'none', border: 'none', color: '#7e8b9b', cursor: 'pointer', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: '24px' }}
          >
            ← Back to System Interface
          </button>
          
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px', color: '#ffffff' }}>MGS Data Analytics Dashboard</h2>
          <p style={{ color: '#7e8b9b', fontFamily: 'monospace', fontSize: '12px', marginBottom: '24px' }}>[STATUS: PIPELINE_READY // ENGINE: FASTAPI]</p>
          
          <textarea 
            value={inputData}
            onChange={(e) => setInputData(e.target.value)}
            style={{ width: '100%', height: '180px', padding: '16px', backgroundColor: '#0a0f1d', border: '1px solid rgba(0, 229, 255, 0.1)', borderRadius: '4px', color: '#f4f6fa', fontFamily: 'monospace', fontSize: '14px', outline: 'none', resize: 'none', marginBottom: '16px' }}
            placeholder="Paste raw engineering datasets, standard tags, or failure event descriptions here..."
          />
          
          <button 
            onClick={handleExecuteSolver}
            disabled={isLoading}
            style={{ padding: '12px 32px', backgroundColor: isLoading ? '#334155' : '#00e5ff', border: 'none', color: '#0a0f1d', fontSize: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.1em', borderRadius: '2px', cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.3s' }}
          >
            {isLoading ? 'Processing Pipeline...' : 'Execute Core Solver'}
          </button>

          {/* BOX OUTPUT HASIL PROSES DATA ANOMALIES/SOLVER */}
          {outputResult && (
            <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#0a0f1d', border: '1px solid rgba(0, 230, 118, 0.2)', borderRadius: '4px' }}>
              <h4 style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.2em', color: '#00e676', marginBottom: '8px', fontFamily: 'monospace' }}>[SOLVER_OUTPUT_RESULT]</h4>
              <pre style={{ margin: 0, color: '#f4f6fa', fontFamily: 'monospace', fontSize: '14px', whiteSpace: 'pre-wrap', overflowX: 'auto' }}>
                {outputResult}
              </pre>
            </div>
          )}

        </div>
      </div>
    );
  }

  // TAMPILAN DASHBOARD LANDING PAGE UTAMA (CYBER TELEMETRY)
  return (
    <div style={{ minHeight: '100vh', width: '100%', backgroundColor: '#0a0f1d', color: '#f4f6fa', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', fontFamily: 'sans-serif' }}>
      
      {/* Background Grids */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: 'linear-gradient(rgba(0, 229, 255, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 229, 255, 0.02) 1px, transparent 1px)', backgroundSize: '40px 40px', backgroundPosition: 'center', pointerEvents: 'none', zIndex: 1 }}></div>
      
      {/* Canvas Animation */}
      <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 2 }}></canvas>

      {/* Telemetry HUD */}
      <div style={{ position: 'absolute', fontFamily: 'monospace', fontSize: '10px', color: '#7e8b9b', pointerEvents: 'none', zIndex: 3, top: '20px', left: '20px', textAlign: 'left' }}>
        SYS.LOC: [06°11'21"S // 106°49'44"E]<br />
        ASSET.EVAL: <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>VALID</span><br />
        RELIABILITY_IDX: <span style={{ color: '#00e676', fontWeight: 'bold' }}>0.99942</span><br />
        MODEL.TYPE: PRED_ANOMALY
      </div>

      <div style={{ position: 'absolute', fontFamily: 'monospace', fontSize: '10px', color: '#7e8b9b', pointerEvents: 'none', zIndex: 3, bottom: '20px', left: '20px', textAlign: 'left' }}>
        [MATRIX DATA FLOW]<br />
        10011010 00110101 11001110<br />
        01101100 <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>14224.ISO</span> 01011011<br />
        STATUS: SYSTEM_LAUNCH
      </div>

      <div style={{ position: 'absolute', fontFamily: 'monospace', fontSize: '10px', color: '#7e8b9b', pointerEvents: 'none', zIndex: 3, top: '20px', right: '20px', textAlign: 'right' }}>
        PARAMETER MATRIX v55.000<br />
        X-AXIS_DEV: +0.0034mm<br />
        Y-AXIS_DEV: -0.0012mm<br />
        Z-AXIS_TGT: <span style={{ color: '#00e5ff', fontWeight: 'bold' }}>100.00%</span>
      </div>

      <div style={{ position: 'absolute', fontFamily: 'monospace', fontSize: '10px', color: '#7e8b9b', pointerEvents: 'none', zIndex: 3, bottom: '20px', right: '20px', textAlign: 'right' }}>
        RESOLUTION: ITERATIVE<br />
        DYNAMIC SOLVER: ACTIVE<br />
        OPTIMAL CONFIG FOUND.<br />
        <span style={{ color: '#00e676', fontWeight: 'bold' }}>✓ ROOT_CAUSE_RESOLVED</span>
      </div>

      {/* Container */}
      <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '32px', maxWidth: '680px', width: '90%' }}>
        <div style={{ fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.4em', color: '#00e676', marginBottom: '24px' }}>
          Megah Global Solution
        </div>
        <h1 style={{ fontSize: '2.5rem', fontWeight: '800', letterSpacing: '-0.02em', lineHeight: 1.25, marginBottom: '40px', color: '#ffffff' }}>
          Advanced Intelligence Solutions with Human in the Loop.
        </h1>

        <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a 
            href="mailto:jenmegahs@gmail.com?subject=Inquiry:%20Strategic%20Engineering%20Solution%20Discussion"
            style={{ display: 'inline-block', backgroundColor: '#0a0f1d', color: '#00e5ff', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.2em', padding: '16px 40px', border: '1px solid #00e5ff', borderRadius: '2px', cursor: 'pointer', textDecoration: 'none', transition: 'all 0.3s' }}
          >
            Discuss Now
          </a>

          <button 
            onClick={() => setShowApp(true)}
            style={{ display: 'inline-block', backgroundColor: '#0a0f1d', color: '#00e676', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.2em', padding: '16px 32px', border: '1px solid #00e676', borderRadius: '2px', cursor: 'pointer', transition: 'all 0.3s' }}
          >
            Explore MGS Data Analytics
          </button>
        </div>
      </div>

    </div>
  );
}

export default App;