// add classes for mobile navigation toggling
var CSbody = document.querySelector('body');
const CSnavbarMenu = document.querySelector('#cs-navigation');
const CShamburgerMenu = document.querySelector('#cs-navigation .cs-toggle');

CShamburgerMenu.addEventListener('click', function () {
	CShamburgerMenu.classList.toggle('cs-active');
	CSnavbarMenu.classList.toggle('cs-active');
	CSbody.classList.toggle('cs-open');
	// run the function to check the aria-expanded value
	ariaExpanded();
});

// checks the value of aria expanded on the cs-ul and changes it accordingly whether it is expanded or not
function ariaExpanded() {
	const csUL = document.querySelector('#cs-expanded');
	const csExpanded = csUL.getAttribute('aria-expanded');

	if (csExpanded === 'false') {
		csUL.setAttribute('aria-expanded', 'true');
	} else {
		csUL.setAttribute('aria-expanded', 'false');
	}
}

// This script adds a class to the body after scrolling 100px
// and we used these body.scroll styles to create some on scroll 
// animations with the navbar

document.addEventListener('scroll', (e) => { 
	const scroll = document.documentElement.scrollTop;
	if(scroll >= 100){
document.querySelector('body').classList.add('scroll')
	} else {
	document.querySelector('body').classList.remove('scroll')
	}
});
// mobile nav toggle code
const dropDowns = Array.from(document.querySelectorAll('#cs-navigation .cs-dropdown'));
for (const item of dropDowns) {
	const onClick = () => {
		item.classList.toggle('cs-active');
	};
	item.addEventListener('click', onClick);
}


// get current year for credit in footer
document.querySelector("#current-year").textContent = new Date().getFullYear();

// locations slider controls
const locationsSection = document.querySelector('#locations');

if (locationsSection) {
	const track = locationsSection.querySelector('#locations-card-group');
	const prevButton = locationsSection.querySelector('.locations-arrow.prev');
	const nextButton = locationsSection.querySelector('.locations-arrow.next');
	const sliderTrack = locationsSection.querySelector('.locations-slider-track');
	const sliderThumb = locationsSection.querySelector('.locations-slider-thumb');

	if (track && prevButton && nextButton && sliderTrack && sliderThumb) {
		const isMobile = () => window.matchMedia('(max-width: 1023px)').matches;
		
		const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
		const getVisibleCardCount = () => {
			if (window.matchMedia('(min-width: 80rem)').matches) return 3;
			if (window.matchMedia('(min-width: 56.25rem)').matches) return 2;
			return 1;
		};

		const removeClones = () => {
			track.querySelectorAll('.locations-slide[data-clone="true"]').forEach((clone) => clone.remove());
		};

		const getBaseSlides = () => Array.from(track.querySelectorAll('.locations-slide')).filter((slide) => !slide.hasAttribute('data-clone'));

		let baseSlides = getBaseSlides();
		let renderedSlides = [];
		let visibleCards = 1;
		let cloneCount = 1;
		let logicalIndex = 0;
		let renderedIndex = 1;
		let slideStep = 1;
		let isAnimating = false;
		let unlockTimer = null;

		const clearUnlockTimer = () => {
			if (unlockTimer) {
				window.clearTimeout(unlockTimer);
				unlockTimer = null;
			}
		};

		const setThumbPosition = () => {
			const totalStops = baseSlides.length;
			if (totalStops <= 1) {
				sliderThumb.style.width = '100%';
				sliderThumb.style.left = '0%';
				return;
			}

			const widthPct = 100 / totalStops;
			const leftPct = clamp01(logicalIndex / totalStops) * 100;

			sliderThumb.style.width = `${widthPct}%`;
			sliderThumb.style.left = `${leftPct}%`;
		};

		const setTrackPosition = (index, animate = true) => {
			if (!isMobile()) return;
			
			if (!track.style.transition) {
				track.style.transition = 'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)';
			}

			track.style.transition = animate ? 'transform 0.55s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none';
			track.style.transform = `translate3d(${-index * slideStep}px, 0, 0)`;
		};

		const rebuild = () => {
			if (!isMobile()) {
				// Desktop: clean up slider artifacts
				clearUnlockTimer();
				removeClones();
				track.style.transform = 'translate3d(0, 0, 0)';
				track.style.transition = 'none';
				isAnimating = false;
				return;
			}
			
			// Mobile: full slider functionality
			clearUnlockTimer();
			removeClones();
			baseSlides = getBaseSlides();

			if (baseSlides.length < 2) {
				track.style.transform = 'translate3d(0, 0, 0)';
				sliderThumb.style.width = '100%';
				sliderThumb.style.left = '0%';
				cloneCount = 0;
				logicalIndex = 0;
				renderedIndex = 0;
				renderedSlides = baseSlides;
				isAnimating = false;
				return;
			}

			visibleCards = Math.min(getVisibleCardCount(), baseSlides.length);
			cloneCount = Math.min(visibleCards, baseSlides.length);
			logicalIndex = ((logicalIndex % baseSlides.length) + baseSlides.length) % baseSlides.length;

			for (let i = 0; i < cloneCount; i += 1) {
				const leadingClone = baseSlides[baseSlides.length - cloneCount + i].cloneNode(true);
				leadingClone.setAttribute('data-clone', 'true');
				leadingClone.setAttribute('aria-hidden', 'true');
				track.insertBefore(leadingClone, track.firstChild);
			}

			for (let i = 0; i < cloneCount; i += 1) {
				const trailingClone = baseSlides[i].cloneNode(true);
				trailingClone.setAttribute('data-clone', 'true');
				trailingClone.setAttribute('aria-hidden', 'true');
				track.appendChild(trailingClone);
			}

			renderedSlides = Array.from(track.querySelectorAll('.locations-slide'));
			const gapValue = parseFloat(window.getComputedStyle(track).columnGap || window.getComputedStyle(track).gap || '0');
			slideStep = (renderedSlides[0] ? renderedSlides[0].getBoundingClientRect().width : 0) + (Number.isFinite(gapValue) ? gapValue : 0);
			renderedIndex = logicalIndex + cloneCount;
			isAnimating = false;

			setTrackPosition(renderedIndex, false);
			setThumbPosition();
		};

		const finishAnimation = () => {
			if (baseSlides.length < 2) {
				isAnimating = false;
				return;
			}

			if (renderedIndex < cloneCount) {
				renderedIndex += baseSlides.length;
				setTrackPosition(renderedIndex, false);
			} else if (renderedIndex >= cloneCount + baseSlides.length) {
				renderedIndex -= baseSlides.length;
				setTrackPosition(renderedIndex, false);
			}

			isAnimating = false;
		};

		const animateTo = (targetRenderedIndex, nextLogicalIndex) => {
			if (!isMobile() || isAnimating || baseSlides.length < 2) return;

			isAnimating = true;
			clearUnlockTimer();

			logicalIndex = ((nextLogicalIndex % baseSlides.length) + baseSlides.length) % baseSlides.length;
			renderedIndex = targetRenderedIndex;
			setTrackPosition(renderedIndex, true);
			setThumbPosition();

			unlockTimer = window.setTimeout(() => {
				finishAnimation();
			}, 700);
		};

		track.addEventListener('transitionend', (event) => {
			if (event.propertyName !== 'transform' || !isAnimating) return;
			clearUnlockTimer();
			finishAnimation();
		});

		prevButton.addEventListener('click', () => {
			animateTo(renderedIndex - 1, logicalIndex - 1);
		});

		nextButton.addEventListener('click', () => {
			animateTo(renderedIndex + 1, logicalIndex + 1);
		});

		sliderTrack.addEventListener('click', (event) => {
			const totalStops = baseSlides.length;
			if (totalStops <= 1 || isAnimating) return;

			const bounds = sliderTrack.getBoundingClientRect();
			const clickX = event.clientX - bounds.left;
			const clickRatio = clamp01(clickX / bounds.width);
			const targetIndex = Math.min(Math.round(clickRatio * totalStops), totalStops - 1);
			if (targetIndex === logicalIndex) return;

			const centerIndex = cloneCount + targetIndex;
			const candidateIndexes = [
				centerIndex - baseSlides.length,
				centerIndex,
				centerIndex + baseSlides.length,
			];

			let closestIndex = candidateIndexes[0];
			let closestDistance = Math.abs(candidateIndexes[0] - renderedIndex);

			for (let i = 1; i < candidateIndexes.length; i += 1) {
				const candidateDistance = Math.abs(candidateIndexes[i] - renderedIndex);
				if (candidateDistance < closestDistance) {
					closestDistance = candidateDistance;
					closestIndex = candidateIndexes[i];
				}
			}

			animateTo(closestIndex, targetIndex);
		});

		window.addEventListener('resize', () => {
			rebuild();
		});

		rebuild();
		window.requestAnimationFrame(() => {
			rebuild();
		});

		if (document.readyState === 'complete') {
			rebuild();
		} else {
			window.addEventListener('load', rebuild, { once: true });
		}
	}
}

// Defer map embeds until they are close to viewport to reduce early network work.
const deferredMapIframes = Array.from(document.querySelectorAll('iframe[data-map-src]'));

if (deferredMapIframes.length > 0) {
	const MAP_DEFER_DELAY_MS = 1200;

	const setMapFrameState = (iframe, stateClass) => {
		const mapLink = iframe ? iframe.closest('.map-frame') : null;
		if (!mapLink) return;

		mapLink.classList.remove('is-map-loading', 'is-map-loaded');
		if (stateClass) {
			mapLink.classList.add(stateClass);
		}
	};

	const loadLikelyVisibleMapIframes = () => {
		const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
		const viewportWidth = window.innerWidth || document.documentElement.clientWidth;

		for (const iframe of deferredMapIframes) {
			if (!iframe || iframe.dataset.mapLoaded === 'true') {
				continue;
			}

			const rect = iframe.getBoundingClientRect();
			const nearViewport = rect.bottom >= -160
				&& rect.top <= viewportHeight + 160
				&& rect.right >= -160
				&& rect.left <= viewportWidth + 160;

			if (nearViewport) {
				loadMapIframe(iframe);
			}
		}
	};

	const loadMapIframe = (iframe) => {
		if (!iframe || iframe.dataset.mapLoaded === 'true') {
			return;
		}

		const mapSrc = iframe.getAttribute('data-map-src');
		if (!mapSrc) {
			return;
		}

		const matchingIframes = Array.from(document.querySelectorAll('iframe[data-map-src]'));

		for (const mapIframe of matchingIframes) {
			if (mapIframe.getAttribute('data-map-src') !== mapSrc) {
				continue;
			}

			if (mapIframe.dataset.mapLoaded === 'true') {
				continue;
			}

			setMapFrameState(mapIframe, 'is-map-loading');
			mapIframe.addEventListener('load', () => {
				setMapFrameState(mapIframe, 'is-map-loaded');
			}, { once: true });
			mapIframe.setAttribute('src', mapSrc);
			mapIframe.dataset.mapLoaded = 'true';
		}
	};

	for (const iframe of deferredMapIframes) {
		setMapFrameState(iframe, 'is-map-loading');
	}

	// Load on strong user intent even before intersection.
	for (const iframe of deferredMapIframes) {
		const mapLink = iframe.closest('.map-frame');
		if (!mapLink) continue;

		const onIntent = () => loadMapIframe(iframe);
		mapLink.addEventListener('pointerenter', onIntent, { passive: true, once: true });
		mapLink.addEventListener('focusin', onIntent, { once: true });
	}

	const startDeferredMapLoading = () => {
		if ('IntersectionObserver' in window) {
			const mapObserver = new IntersectionObserver((entries, observer) => {
				for (const entry of entries) {
					if (!entry.isIntersecting) {
						continue;
					}

					loadMapIframe(entry.target);
					observer.unobserve(entry.target);
				}
			}, {
				rootMargin: '125px 0px',
				threshold: 0.01
			});

			for (const iframe of deferredMapIframes) {
				mapObserver.observe(iframe);
			}

			// Fallback for browsers/layout states where observer callbacks can be delayed.
			loadLikelyVisibleMapIframes();
			window.addEventListener('scroll', loadLikelyVisibleMapIframes, { passive: true });
			window.addEventListener('resize', loadLikelyVisibleMapIframes, { passive: true });
			window.addEventListener('orientationchange', loadLikelyVisibleMapIframes, { passive: true });
		} else {
			for (const iframe of deferredMapIframes) {
				loadMapIframe(iframe);
			}
		}
	};

	if (document.readyState === 'complete') {
		window.setTimeout(startDeferredMapLoading, MAP_DEFER_DELAY_MS);
	} else {
		window.addEventListener('load', () => {
			window.setTimeout(startDeferredMapLoading, MAP_DEFER_DELAY_MS);
		}, { once: true });
	}
}