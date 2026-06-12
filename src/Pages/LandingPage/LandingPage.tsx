import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

export default function LandingPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const navigate = useNavigate();
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animFrameId: number;
    let particles: Particle[] = [];
    let particleCount = window.innerWidth < 768 ? 40 : 80;
    const connectionDistance = 140;
    const mouse = { x: null as number | null, y: null as number | null, radius: 150, clickActive: false, clickTimer: 0 };

    class Particle {
      x: number; y: number; vx: number; vy: number; size: number; isGreen: boolean;
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
          const dx = this.x - mouse.x;
          const dy = this.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < mouse.radius) {
            const force = (mouse.radius - distance) / mouse.radius;
            const strength = mouse.clickActive ? force * 15 : force * 2;
            const angle = Math.atan2(dy, dx);
            this.x += Math.cos(angle) * strength;
            this.y += Math.sin(angle) * strength;
          }
        }
      }
      draw() {
        ctx!.beginPath();
        ctx!.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx!.fillStyle = this.isGreen ? "rgba(0, 230, 118, 0.6)" : "rgba(0, 229, 255, 0.5)";
        ctx!.fill();
      }
    }

    function resizeCanvas() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      particleCount = window.innerWidth < 768 ? 40 : 80;
    }

    function init() {
      particles = [];
      for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    }

    function drawLines() {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < connectionDistance) {
            const alpha = (1 - distance / connectionDistance) * 0.12;
            ctx!.strokeStyle = `rgba(0, 229, 255, ${alpha})`;
            ctx!.lineWidth = 1;
            ctx!.beginPath();
            ctx!.moveTo(particles[i].x, particles[i].y);
            ctx!.lineTo(particles[j].x, particles[j].y);
            ctx!.stroke();
          }
        }
      }
    }

    function animate() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      if (mouse.clickActive) {
        mouse.clickTimer--;
        if (mouse.clickTimer <= 0) mouse.clickActive = false;
      }
      drawLines();
      particles.forEach((p) => { p.update(); p.draw(); });
      animFrameId = requestAnimationFrame(animate);
    }

    const onMouseMove = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; };
    const onMouseLeave = () => { mouse.x = null; mouse.y = null; };
    const onMouseDown = (e: MouseEvent) => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.clickActive = true; mouse.clickTimer = 18; };
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) { mouse.x = e.touches[0].clientX; mouse.y = e.touches[0].clientY; mouse.clickActive = true; mouse.clickTimer = 18; }
    };

    resizeCanvas();
    init();
    animate();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("touchstart", onTouchStart);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, []);

  return (
    <div style={styles.body}>
      {/* Grid Background */}
      <div style={styles.blueprintBg} />
      <div style={styles.axisX} />
      <div style={styles.axisY} />

      {/* Crosshairs */}
      <div style={{ ...styles.crosshair, top: 15, left: 15, borderRight: 0, borderBottom: 0 }} />
      <div style={{ ...styles.crosshair, top: 15, right: 15, borderLeft: 0, borderBottom: 0 }} />
      <div style={{ ...styles.crosshair, bottom: 15, left: 15, borderRight: 0, borderTop: 0 }} />
      <div style={{ ...styles.crosshair, bottom: 15, right: 15, borderLeft: 0, borderTop: 0 }} />

      {/* Canvas */}
      <canvas ref={canvasRef} style={styles.canvas} />

      {/* HUD Telemetry */}
      <div style={{ ...styles.telemetry, top: 20, left: 20, textAlign: "left" }}>
        SYS.LOC: [06°11'21"S // 106°49'44"E]<br />
        ASSET.EVAL: <span style={styles.metricBlue}>VALID</span><br />
        RELIABILITY_IDX: <span style={styles.metricGreen}>0.99942</span><br />
        MODEL.TYPE: PRED_ANOMALY
      </div>
      <div style={{ ...styles.telemetry, bottom: 20, left: 20, textAlign: "left" }}>
        [MATRIX DATA FLOW]<br />
        10011010 00110101 11001110<br />
        01101100 <span style={styles.metricBlue}>14224.ISO</span> 01011011<br />
        STATUS: SYSTEM_LAUNCH
      </div>
      <div style={{ ...styles.telemetry, top: 20, right: 20, textAlign: "right" }}>
        PARAMETER MATRIX v55.000<br />
        X-AXIS_DEV: +0.0034mm<br />
        Y-AXIS_DEV: -0.0012mm<br />
        Z-AXIS_TGT: <span style={styles.metricBlue}>100.00%</span>
      </div>
      <div style={{ ...styles.telemetry, bottom: 20, right: 20, textAlign: "right" }}>
        RESOLUTION: ITERATIVE<br />
        DYNAMIC SOLVER: ACTIVE<br />
        OPTIMAL CONFIG FOUND.<br />
        <span style={styles.metricGreen}>✓ ROOT_CAUSE_RESOLVED</span>
      </div>

      {/* Main Content */}
      <div style={styles.container}>
        <div style={styles.brand}>Megah Global Solution</div>
        <h1 style={styles.title}>Advanced Intelligence Solutions with Human in the Loop.</h1>

        {/* Discuss Now Button */}
        <a
          href="mailto:jenmegahs@gmail.com?subject=Inquiry:%20Strategic%20Engineering%20Solution%20Discussion&body=Halo%20Megah%20Global%20Solution%2C%0A%0ASaya%20tertarik%20untuk%20berdiskusi%20lebih%20lanjut%20mengenai%20solusi%20dan%20optimasi%20teknis%20untuk%20operasional%20kami.%0A%0ABerikut%20adalah%20detail%20permasalahan/bottleneck%20spesifik%20yang%20sedang%20kami%20hadapi%3A%0A%5BTulis%20detail%20permasalahan%20atau%20problem%20Anda%20di%20sini%5D%0A%0A%0AHormat%20saya%2C%0A%5BNama%20Anda%5D%0A%5BPerusahaan/Jabatan%5D"
          style={styles.btnDiscuss}
          onMouseEnter={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.color = "#0a0f1d";
            el.style.backgroundColor = "#00e5ff";
            el.style.boxShadow = "0 0 30px rgba(0, 229, 255, 0.3)";
            el.style.transform = "translateY(-2px)";
          }}
          onMouseLeave={(e) => {
            const el = e.currentTarget as HTMLAnchorElement;
            el.style.color = "#00e5ff";
            el.style.backgroundColor = "#0a0f1d";
            el.style.boxShadow = "0 0 20px rgba(0, 229, 255, 0.05)";
            el.style.transform = "translateY(0)";
          }}
        >
          Discuss Now
        </a>

        {/* Explore MGS Data Analytics Button */}
        <button
  onClick={() => navigate("/MGSDataAnalytics")}
  style={styles.btnExplore}
  onMouseEnter={(e) => {
    const el = e.currentTarget as HTMLButtonElement;
    el.style.color = "#0a0f1d";
    el.style.backgroundColor = "#00e676";
    el.style.boxShadow = "0 0 30px rgba(0, 230, 118, 0.3)";
    el.style.transform = "translateY(-2px)";
  }}
  onMouseLeave={(e) => {
    const el = e.currentTarget as HTMLButtonElement;
    el.style.color = "#00e676";
    el.style.backgroundColor = "#0a0f1d";
    el.style.boxShadow = "0 0 20px rgba(0, 230, 118, 0.05)";
    el.style.transform = "translateY(0)";
  }}
>
  Explore MGS Data Analytics
<button
  onClick={() => navigate("/MGSDataAnalytics")}
  style={styles.btnExplore}
  onMouseEnter={(e) => {
    const el = e.currentTarget as HTMLButtonElement;
    el.style.color = "#0a0f1d";
    el.style.backgroundColor = "#00e676";
    el.style.boxShadow = "0 0 30px rgba(0, 230, 118, 0.3)";
    el.style.transform = "translateY(-2px)";
  }}
  onMouseLeave={(e) => {
    const el = e.currentTarget as HTMLButtonElement;
    el.style.color = "#00e676";
    el.style.backgroundColor = "#0a0f1d";
    el.style.boxShadow = "0 0 20px rgba(0, 230, 118, 0.05)";
    el.style.transform = "translateY(0)";
  }}
>
  Explore MGS Data Analytics
</button>

  MRT Tracker
</button>

      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#0a0f1d",
    color: "#f4f6fa",
    minHeight: "100vh",
    width: "100%",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  blueprintBg: {
    position: "absolute",
    top: 0, left: 0,
    width: "100%", height: "100%",
    backgroundImage: `linear-gradient(rgba(0,229,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.02) 1px, transparent 1px)`,
    backgroundSize: "40px 40px",
    backgroundPosition: "center",
    zIndex: 1,
    pointerEvents: "none",
  },
  axisX: {
    position: "absolute",
    top: "30%", left: 0,
    width: "100%", height: 1,
    background: "linear-gradient(90deg, transparent, rgba(0,229,255,0.06), transparent)",
    zIndex: 1, pointerEvents: "none",
  },
  axisY: {
    position: "absolute",
    left: "15%", top: 0,
    width: 1, height: "100%",
    background: "linear-gradient(180deg, transparent, rgba(0,229,255,0.06), transparent)",
    zIndex: 1, pointerEvents: "none",
  },
  canvas: {
    position: "absolute",
    top: 0, left: 0,
    width: "100%", height: "100%",
    zIndex: 2,
  },
  crosshair: {
    position: "absolute",
    width: 10, height: 10,
    border: "1px solid rgba(0, 229, 255, 0.15)",
    zIndex: 3, pointerEvents: "none",
  },
  telemetry: {
    position: "absolute",
    fontFamily: "monospace",
    fontSize: 10,
    color: "#7e8b9b",
    pointerEvents: "none",
    zIndex: 3,
    lineHeight: 1.5,
  },
  metricBlue: {
    color: "#00e5ff",
    fontWeight: "bold",
  },
  metricGreen: {
    color: "#00e676",
    fontWeight: "bold",
  },
  container: {
    position: "relative",
    zIndex: 10,
    textAlign: "center",
    padding: "2rem",
    maxWidth: 680,
    width: "90%",
    background: "transparent",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1rem",
  },
  brand: {
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.4em",
    color: "#00e676",
    marginBottom: "0.5rem",
    textShadow: "0 0 10px rgba(0, 230, 118, 0.3)",
  },
  title: {
    fontSize: "2.8rem",
    fontWeight: 800,
    letterSpacing: "-0.02em",
    lineHeight: 1.25,
    marginBottom: "1.5rem",
    background: "linear-gradient(135deg, #ffffff 40%, #a3b8cc 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
  },
  btnDiscuss: {
    display: "inline-block",
    backgroundColor: "#0a0f1d",
    color: "#00e5ff",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    padding: "16px 40px",
    border: "1px solid #00e5ff",
    borderRadius: 4,
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: "0 0 20px rgba(0, 229, 255, 0.05)",
    width: "100%",
    maxWidth: 320,
  },
  btnExplore: {
    display: "inline-block",
    backgroundColor: "#0a0f1d",
    color: "#00e676",
    fontSize: 13,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.2em",
    padding: "16px 40px",
    border: "1px solid #00e676",
    borderRadius: 4,
    cursor: "pointer",
    textDecoration: "none",
    transition: "all 0.4s cubic-bezier(0.16, 1, 0.3, 1)",
    boxShadow: "0 0 20px rgba(0, 230, 118, 0.05)",
    width: "100%",
    maxWidth: 320,
  },
};