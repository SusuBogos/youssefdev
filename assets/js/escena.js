// Escena viva: lluvia, hojas de arce y motas en la niebla (un solo canvas) + paralaje con el ratón.
// Todo se detiene con prefers-reduced-motion y cuando la pestaña no está visible.

const movimientoReducido = window.matchMedia("(prefers-reduced-motion: reduce)");
const punteroFino = window.matchMedia("(pointer: fine)");
const azar = (min, max) => min + Math.random() * (max - min);

/* ───────── Atmósfera ───────── */
function crearAtmosfera(canvas) {
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return () => {};

  let ancho = 0, alto = 0, escala = 1;
  let gotas = [], hojas = [], motas = [];
  let marco = 0, anterior = 0, inicio = 0, activa = false;

  // Silueta de hoja de arce: mitad derecha dentada + tallo, reflejada
  const mitad = [[0, -1], [.1, -.7], [.2, -.74], [.17, -.5], [.4, -.76], [.38, -.5], [.5, -.56], [.4, -.3],
    [.84, -.48], [.72, -.28], [.9, -.2], [.62, -.06], [.98, .08], [.58, .14], [.66, .3], [.4, .24], [.42, .44], [.12, .3], [.04, .38]];
  const contorno = [...mitad, [.03, 1.05], [-.03, 1.05], ...mitad.slice(1).reverse().map(([x, y]) => [-x, y])];
  const hoja = new Path2D();
  contorno.forEach(([x, y], k) => (k ? hoja.lineTo(x, y) : hoja.moveTo(x, y)));
  hoja.closePath();

  function poblar() {
    const area = ancho * alto;
    const movil = ancho < 700;
    const nGotas = Math.round(Math.min(movil ? 90 : 230, area / (movil ? 3600 : 6200)));
    gotas = Array.from({ length: nGotas }, () => nuevaGota(true));
    hojas = Array.from({ length: movil ? 4 : 7 }, () => nuevaHoja(true));
    motas = Array.from({ length: movil ? 8 : 16 }, nuevaMota);
  }

  function nuevaGota(dispersa) {
    const z = Math.random() ** 1.6; // más gotas lejanas que cercanas
    return {
      x: azar(-ancho * .1, ancho * 1.05),
      y: dispersa ? azar(-alto, alto) : azar(-alto * .3, -20),
      z,
      largo: 7 + z * 26,
      vel: 520 + z * 900,
    };
  }

  function nuevaHoja(dispersa) {
    const z = azar(.3, 1);
    return {
      x: azar(-.05, 1) * ancho,
      y: dispersa ? azar(-alto, alto * .8) : azar(-120, -30),
      z,
      tam: 3.5 + z * 6.5,
      vel: 22 + z * 34,
      fase: azar(0, Math.PI * 2),
      giro: azar(.6, 1.4),
      color: ["#8f1420", "#a31522", "#6e0f18", "#7a1d14"][Math.floor(Math.random() * 4)],
    };
  }

  function nuevaMota() {
    return {
      x: azar(0, ancho),
      y: azar(alto * .35, alto * .92),
      r: azar(.5, 1.5),
      vx: azar(-6, 6),
      vy: azar(-4, 2),
      fase: azar(0, Math.PI * 2),
      ritmo: azar(.15, .45),
    };
  }

  function medir() {
    const caja = canvas.getBoundingClientRect();
    ancho = Math.max(1, caja.width);
    alto = Math.max(1, caja.height);
    escala = Math.min(window.devicePixelRatio || 1, ancho < 700 ? 1.25 : 1.5);
    canvas.width = Math.round(ancho * escala);
    canvas.height = Math.round(alto * escala);
    ctx.setTransform(escala, 0, 0, escala, 0, 0);
    poblar();
  }

  const viento = -.16; // inclinación de la lluvia (dx por unidad de caída)

  function dibujar(ahora) {
    const dt = Math.min(.05, (ahora - anterior) / 1000 || 0);
    anterior = ahora;
    // La atmósfera entra después del corte del título
    const entrada = Math.min(1, Math.max(0, (ahora - inicio - 2200) / 2500));
    ctx.clearRect(0, 0, ancho, alto);
    if (entrada <= 0) { marco = requestAnimationFrame(dibujar); return; }

    // Motas suspendidas en la niebla
    for (const m of motas) {
      m.x += m.vx * dt; m.y += m.vy * dt; m.fase += m.ritmo * dt;
      if (m.x < -10) m.x = ancho + 10; else if (m.x > ancho + 10) m.x = -10;
      if (m.y < alto * .3 || m.y > alto) Object.assign(m, nuevaMota());
      const a = entrada * .32 * Math.max(0, Math.sin(m.fase)) ** 2;
      if (a < .01) continue;
      ctx.fillStyle = `rgba(215,225,240,${a * .25})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 3.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgba(235,240,250,${a})`;
      ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2); ctx.fill();
    }

    // Lluvia en tres planos: un solo trazo por plano
    const planos = [[], [], []];
    for (const g of gotas) {
      g.y += g.vel * dt;
      g.x += g.vel * viento * dt;
      if (g.y - g.largo > alto) Object.assign(g, nuevaGota(false));
      planos[g.z < .35 ? 0 : g.z < .75 ? 1 : 2].push(g);
    }
    const estilos = [[.07, .6], [.12, .9], [.2, 1.25]];
    planos.forEach((lista, p) => {
      if (!lista.length) return;
      ctx.strokeStyle = `rgba(200,212,228,${estilos[p][0] * entrada})`;
      ctx.lineWidth = estilos[p][1];
      ctx.beginPath();
      for (const g of lista) {
        ctx.moveTo(g.x, g.y);
        ctx.lineTo(g.x - g.largo * viento, g.y - g.largo);
      }
      ctx.stroke();
    });

    // Hojas de arce cayendo, con balanceo y giro en 3D simulado
    for (const h of hojas) {
      h.fase += dt * h.giro;
      h.y += h.vel * dt;
      h.x += (Math.sin(h.fase * .9) * 26 - 10) * dt;
      if (h.y > alto + 30) Object.assign(h, nuevaHoja(false));
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(Math.sin(h.fase) * .9 + h.fase * .3);
      ctx.scale(h.tam * Math.cos(h.fase * 1.3), h.tam);
      ctx.globalAlpha = entrada * (.3 + h.z * .45);
      ctx.fillStyle = h.color;
      ctx.fill(hoja);
      ctx.restore();
    }

    marco = requestAnimationFrame(dibujar);
  }

  function arrancar() {
    if (activa || movimientoReducido.matches || document.hidden) return;
    activa = true;
    anterior = performance.now();
    if (!inicio) inicio = anterior;
    marco = requestAnimationFrame(dibujar);
  }
  function parar() {
    activa = false;
    cancelAnimationFrame(marco);
  }

  let espera = 0;
  const alRedimensionar = () => { clearTimeout(espera); espera = setTimeout(medir, 150); };
  const alCambiarVisibilidad = () => (document.hidden ? parar() : arrancar());
  const alCambiarMovimiento = () => {
    if (movimientoReducido.matches) { parar(); ctx.clearRect(0, 0, ancho, alto); } else arrancar();
  };

  medir();
  arrancar();
  window.addEventListener("resize", alRedimensionar, { passive: true });
  document.addEventListener("visibilitychange", alCambiarVisibilidad);
  movimientoReducido.addEventListener("change", alCambiarMovimiento);

  return () => {
    parar();
    clearTimeout(espera);
    window.removeEventListener("resize", alRedimensionar);
    document.removeEventListener("visibilitychange", alCambiarVisibilidad);
    movimientoReducido.removeEventListener("change", alCambiarMovimiento);
  };
}

/* ───────── Paralaje ───────── */
function crearParalaje(raiz) {
  if (!punteroFino.matches) return () => {};
  let marco = 0;
  const mover = (e) => {
    if (movimientoReducido.matches) return;
    cancelAnimationFrame(marco);
    marco = requestAnimationFrame(() => {
      raiz.style.setProperty("--mx", ((e.clientX / innerWidth) - .5) * -2);
      raiz.style.setProperty("--my", ((e.clientY / innerHeight) - .5) * -2);
    });
  };
  window.addEventListener("pointermove", mover, { passive: true });
  return () => {
    cancelAnimationFrame(marco);
    window.removeEventListener("pointermove", mover);
  };
}

/* ───────── Arranque ───────── */
const limpiezas = [];
const canvas = document.querySelector(".clima");
if (canvas) limpiezas.push(crearAtmosfera(canvas));
limpiezas.push(crearParalaje(document.documentElement));
window.addEventListener("pagehide", (e) => {
  if (!e.persisted) limpiezas.splice(0).forEach((limpiar) => limpiar());
});
