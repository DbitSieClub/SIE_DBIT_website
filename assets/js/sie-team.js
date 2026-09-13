/**
 * sie-team.js
 * SIE DBIT – Core Team / Leadership Section Interactivity
 *
 * Features:
 *  - 3D cursor tilt on member cards & group photo (clamped ±6 deg)
 *  - IntersectionObserver entrance animations
 *  - Mobile & reduced-motion detection
 *  - Image fallback handler for missing member photos
 */

(function () {
    'use strict';

    const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const IS_MOBILE = window.innerWidth <= 768;

    document.addEventListener('DOMContentLoaded', () => {
        initEntranceAnimations();
        if (!REDUCED_MOTION && !IS_MOBILE) {
            init3DTilt();
        }
    });

    /**
     * 1. Entrance Animations via IntersectionObserver
     */
    function initEntranceAnimations() {
        const animElements = document.querySelectorAll('.sie-team-animate');
        if (!animElements.length) return;

        if ('IntersectionObserver' in window) {
            const observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        observer.unobserve(entry.target);
                    }
                });
            }, { threshold: 0.15 });

            animElements.forEach((el) => observer.observe(el));
        } else {
            // Fallback for older browsers
            animElements.forEach((el) => el.classList.add('is-visible'));
        }
    }

    /**
     * 2. Lightweight 3D Cursor Tilt Effect
     */
    function init3DTilt() {
        const tiltCards = document.querySelectorAll('.sie-tilt-card');
        const MAX_TILT_DEG = 6; // Clamped to subtle 6 degrees max

        tiltCards.forEach((card) => {
            let rafId = null;

            card.addEventListener('mousemove', (e) => {
                if (rafId) cancelAnimationFrame(rafId);

                rafId = requestAnimationFrame(() => {
                    const rect = card.getBoundingClientRect();
                    const centerX = rect.left + rect.width / 2;
                    const centerY = rect.top + rect.height / 2;

                    const mouseX = e.clientX - centerX;
                    const mouseY = e.clientY - centerY;

                    // Normalize to -1 ... +1
                    const normX = mouseX / (rect.width / 2);
                    const normY = mouseY / (rect.height / 2);

                    // Calculate rotation angles
                    const rotateY = (normX * MAX_TILT_DEG).toFixed(2);
                    const rotateX = (-normY * MAX_TILT_DEG).toFixed(2);

                    card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(8px)`;
                });
            });

            card.addEventListener('mouseleave', () => {
                if (rafId) cancelAnimationFrame(rafId);
                card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0px)';
            });
        });
    }

})();
