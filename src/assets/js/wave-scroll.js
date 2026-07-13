document.addEventListener('DOMContentLoaded', function () {
    const waves = Array.from(document.querySelectorAll('.wavy-top, .wavy-bottom'));

    if (!waves.length) {
        return;
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const maxWidth = prefersReducedMotion ? 100 : 112;
    const minWidth = 100;
    const completeAt = 0.8;

    const clamp = function (value, min, max) {
        return Math.min(max, Math.max(min, value));
    };

    const getWaveWidth = function (rect, viewportHeight) {
        let rawProgress = 0;

        if (rect.top >= viewportHeight) {
            rawProgress = 0;
        } else if (rect.bottom <= 0) {
            rawProgress = 1;
        } else {
            rawProgress = (viewportHeight - rect.top) / (viewportHeight + rect.height);
        }

        const progress = clamp(rawProgress, 0, 1);
        const acceleratedProgress = clamp(progress / completeAt, 0, 1);
        return maxWidth - (maxWidth - minWidth) * acceleratedProgress;
    };

    const updateWidths = function () {
        const viewportHeight = window.innerHeight || document.documentElement.clientHeight;

        waves.forEach(function (wave) {
            const rect = wave.getBoundingClientRect();
            const width = getWaveWidth(rect, viewportHeight);
            wave.style.width = width.toFixed(2) + '%';
        });
    };

    // Keep updates immediate to avoid perceptible lag behind scroll.
    waves.forEach(function (wave) {
        wave.style.transition = '0.4s ease-out';
        wave.style.width = maxWidth + '%';
    });

    window.addEventListener('scroll', updateWidths, { passive: true });
    window.addEventListener('resize', updateWidths);
    window.addEventListener('load', updateWidths);

    updateWidths();
});