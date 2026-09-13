/**
 * sie-hero.js
 * SIE DBIT – Hero Section: Three.js Leaf Particles + Parallax
 *
 * Architecture:
 *  - Three.js ES Module (CDN via importmap)
 *  - Single rAF loop
 *  - Leaf particles: PlaneGeometry + canvas-drawn leaf texture
 *  - Mouse parallax: shifts .sie-hero-bg via CSS transform
 *  - Scroll parallax: vertical shift of background
 *  - Pauses when tab is hidden (visibilitychange)
 *  - Pauses when hero is out of view (IntersectionObserver)
 *  - Respects prefers-reduced-motion
 *  - Reduces particle count on mobile
 */

import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────
//  Guards & feature detection
// ─────────────────────────────────────────────────────────────────

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE      = window.innerWidth <= 768;
const CANVAS_ID      = 'sie-hero-canvas';
const BG_ID          = 'sie-hero-bg';

// If user prefers reduced motion, skip Three.js entirely
// CSS already handles static display
if (!REDUCED_MOTION) {

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById(CANVAS_ID);
    const bgEl   = document.getElementById(BG_ID);
    if (!canvas || !bgEl) return;

    // ─────────────────────────────────────────────────────────────
    //  Build a leaf silhouette on a 2D canvas → Three.js texture
    // ─────────────────────────────────────────────────────────────
    function buildLeafTexture() {
        const size = 128;
        const c    = document.createElement('canvas');
        c.width    = size;
        c.height   = size;
        const ctx  = c.getContext('2d');
        ctx.clearRect(0, 0, size, size);

        const palettes = [
            ['#5edf5e', '#2a7a2a'],
            ['#4ade80', '#15803d'],
            ['#86efac', '#166534'],
            ['#a8f57a', '#1a6b28'],
        ];
        const [fill, dark] = palettes[Math.floor(Math.random() * palettes.length)];

        ctx.save();
        ctx.translate(size / 2, size / 2);
        ctx.rotate(Math.PI / 4);

        const grad = ctx.createLinearGradient(-size * 0.3, -size * 0.4, size * 0.3, size * 0.4);
        grad.addColorStop(0, fill);
        grad.addColorStop(1, dark);

        // Leaf body (ellipse)
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 0.28, size * 0.44, 0, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        // Centre vein
        ctx.beginPath();
        ctx.moveTo(0, -size * 0.42);
        ctx.lineTo(0,  size * 0.42);
        ctx.strokeStyle = dark;
        ctx.lineWidth   = 2;
        ctx.globalAlpha = 0.55;
        ctx.stroke();

        // Side veins
        for (let i = -3; i <= 3; i++) {
            if (i === 0) continue;
            const y = i * size * 0.1;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(size * 0.22 * Math.sign(i), y - size * 0.07);
            ctx.globalAlpha = 0.3;
            ctx.stroke();
        }
        ctx.restore();

        const tex = new THREE.CanvasTexture(c);
        tex.needsUpdate = true;
        return tex;
    }

    // ─────────────────────────────────────────────────────────────
    //  Three.js renderer / scene / camera
    // ─────────────────────────────────────────────────────────────
    let W = canvas.offsetWidth  || window.innerWidth;
    let H = canvas.offsetHeight || window.innerHeight;

    let renderer;
    try {
        renderer = new THREE.WebGLRenderer({
            canvas,
            alpha: true,
            antialias: false,
            powerPreference: 'low-power',
        });
    } catch (error) {
        canvas.hidden = true;
        return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, IS_MOBILE ? 1 : 1.5));
    renderer.setSize(W, H);
    renderer.setClearColor(0x000000, 0);

    const scene  = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);
    camera.position.z = 5;

    // ─────────────────────────────────────────────────────────────
    //  Leaf particle instances
    // ─────────────────────────────────────────────────────────────
    const PARTICLE_COUNT   = IS_MOBILE ? 28 : 70;
    const TEXTURE_POOL_SZ  = 5;
    const texturePool      = Array.from({ length: TEXTURE_POOL_SZ }, buildLeafTexture);
    const leafGeo          = new THREE.PlaneGeometry(1, 1);
    const leaves           = [];

    function rnd(min, max) { return min + Math.random() * (max - min); }

    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const tex = texturePool[i % TEXTURE_POOL_SZ];
        const mat = new THREE.MeshBasicMaterial({
            map: tex,
            transparent: true,
            opacity: rnd(0.35, 0.78),
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        const mesh = new THREE.Mesh(leafGeo, mat);
        const s    = rnd(IS_MOBILE ? 0.08 : 0.06, IS_MOBILE ? 0.22 : 0.28);
        mesh.scale.set(s, s, 1);
        mesh.position.set(rnd(-8, 8), rnd(-5, 5), rnd(-2, 0.5));

        mesh.userData = {
            speed:     rnd(0.004, 0.012),
            driftX:    rnd(-0.003, 0.003),
            sway:      rnd(0.5, 1.5),
            swayPhase: rnd(0, Math.PI * 2),
            rotSpeed:  rnd(-0.008, 0.008),
            opacity:   mat.opacity,
            age:       rnd(0, 100),
            lifetime:  rnd(200, 400),
        };

        scene.add(mesh);
        leaves.push(mesh);
    }

    // ─────────────────────────────────────────────────────────────
    //  Mouse / gyroscope parallax
    // ─────────────────────────────────────────────────────────────
    const mouse       = { x: 0, y: 0 };
    const targetMouse = { x: 0, y: 0 };
    const PX_STRENGTH = 18; // px at full tilt

    window.addEventListener('mousemove', (e) => {
        targetMouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
        targetMouse.y =  (e.clientY / window.innerHeight) * 2 - 1;
    }, { passive: true });

    if (IS_MOBILE && window.DeviceOrientationEvent) {
        window.addEventListener('deviceorientation', (e) => {
            if (e.gamma != null) {
                targetMouse.x = Math.max(-1, Math.min(1, e.gamma / 25));
                targetMouse.y = Math.max(-1, Math.min(1, (e.beta - 45) / 25));
            }
        }, { passive: true });
    }

    // ─────────────────────────────────────────────────────────────
    //  Scroll parallax
    // ─────────────────────────────────────────────────────────────
    let scrollY = 0;
    window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });

    // ─────────────────────────────────────────────────────────────
    //  Resize
    // ─────────────────────────────────────────────────────────────
    const resizeObs = new ResizeObserver(() => {
        const hero = canvas.parentElement;
        if (!hero) return;
        W = hero.offsetWidth;
        H = hero.offsetHeight;
        renderer.setSize(W, H);
        camera.aspect = W / H;
        camera.updateProjectionMatrix();
    });
    resizeObs.observe(canvas.parentElement || document.body);

    // ─────────────────────────────────────────────────────────────
    //  Animation loop
    // ─────────────────────────────────────────────────────────────
    let rafId = null;
    let frame = 0;

    function tick() {
        rafId = requestAnimationFrame(tick);
        frame++;

        // Smooth mouse
        mouse.x += (targetMouse.x - mouse.x) * 0.06;
        mouse.y += (targetMouse.y - mouse.y) * 0.06;

        // CSS parallax on background image
        const px = -mouse.x * PX_STRENGTH;
        const py = -mouse.y * PX_STRENGTH - scrollY * 0.12;
        bgEl.style.transform = `translate(${px}px, ${py}px)`;

        // Animate leaves
        const t = frame * 0.016;

        for (let i = 0; i < leaves.length; i++) {
            const leaf = leaves[i];
            const d    = leaf.userData;
            d.age++;

            // Drift upward + horizontal sway
            leaf.position.y -= d.speed;
            leaf.position.x += d.driftX + Math.sin(t * d.sway + d.swayPhase) * 0.002;
            leaf.rotation.z += d.rotSpeed;

            // Subtle tilt from mouse
            leaf.rotation.x = mouse.y * 0.15;
            leaf.rotation.y = mouse.x * 0.15;

            // Opacity envelope (fade in / fade out)
            if (d.age < 30) {
                leaf.material.opacity = (d.age / 30) * d.opacity;
            } else if (d.age > d.lifetime - 30) {
                leaf.material.opacity = ((d.lifetime - d.age) / 30) * d.opacity;
            } else {
                leaf.material.opacity = d.opacity;
            }

            // Reset when fully drifted off or age expires
            if (leaf.position.y < -5 || d.age >= d.lifetime) {
                leaf.position.y = 5 + Math.random() * 2;
                leaf.position.x = rnd(-7, 7);
                d.age      = 0;
                d.lifetime = rnd(200, 400);
                d.speed    = rnd(0.004, 0.012);
                d.driftX   = rnd(-0.003, 0.003);
            }
        }

        renderer.render(scene, camera);
    }

    // ─────────────────────────────────────────────────────────────
    //  Pause / resume on tab visibility
    // ─────────────────────────────────────────────────────────────
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        } else {
            if (!rafId) tick();
        }
    });

    // ─────────────────────────────────────────────────────────────
    //  Pause / resume when hero scrolls out of view
    // ─────────────────────────────────────────────────────────────
    const heroEl = canvas.parentElement;
    if (heroEl && 'IntersectionObserver' in window) {
        new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                if (!rafId) tick();
            } else {
                if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
            }
        }, { threshold: 0.01 }).observe(heroEl);
    }

    // ─────────────────────────────────────────────────────────────
    //  Stat counter animation (counts up smoothly on first view)
    // ─────────────────────────────────────────────────────────────
    function animateCounter(el, target, duration) {
        if (!el) return;
        const start = performance.now();

        function step(now) {
            const progress = Math.min((now - start) / duration, 1);
            // Ease-out cubic
            const eased    = 1 - Math.pow(1 - progress, 3);
            const val      = Math.round(target * eased);
            // Update only the text node (not the <span class="sie-stat-plus">)
            const firstNode = el.firstChild;
            if (firstNode) firstNode.textContent = val;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    }

    const statsEl = document.querySelector('.sie-hero-stats');
    if (statsEl && 'IntersectionObserver' in window) {
        const statIO = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                statIO.disconnect();
                const nums    = statsEl.querySelectorAll('.sie-stat-number');
                const targets = [500, 120, 6];
                nums.forEach((el, i) => animateCounter(el, targets[i], 1800 + i * 200));
            }
        }, { threshold: 0.3 });
        statIO.observe(statsEl);
    }

    // ─────────────────────────────────────────────────────────────
    //  Cleanup
    // ─────────────────────────────────────────────────────────────
    window.addEventListener('beforeunload', () => {
        if (rafId) cancelAnimationFrame(rafId);
        resizeObs.disconnect();
        texturePool.forEach(t => t.dispose());
        leafGeo.dispose();
        renderer.dispose();
    });

    // Start!
    tick();

}); // end DOMContentLoaded

} // end !REDUCED_MOTION guard
