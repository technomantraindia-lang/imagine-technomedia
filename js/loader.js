class ImagineTechnomediaLoader {
  constructor(options = {}) {
    this.config = Object.assign({
      minimumDisplayMs: 1800,
      maximumDisplayMs: 4000,
      sessionKey: "itm_loader_seen_v1",
      playEveryReload: false,
      shouldPlay: true
    }, options);

    this.loader = document.getElementById("itm-loader");
    this.pageShell = document.querySelector(".itm-page-shell");
    this.progressFill = this.loader ? this.loader.querySelector(".itm-loader__progress-fill") : null;
    this.progressValue = this.loader ? this.loader.querySelector(".itm-loader__progress-value") : null;
    this.progressStatus = this.loader ? this.loader.querySelector(".itm-loader__status") : null;
    this.logoCore = this.loader ? this.loader.querySelector(".itm-loader__logo-core") : null;
    this.logoFull = this.loader ? this.loader.querySelector(".itm-loader__logo-full") : null;
    this.scan = this.loader ? this.loader.querySelector(".itm-loader__scan") : null;
    this.beam = this.loader ? this.loader.querySelector(".itm-loader__beam") : null;
    this.beamPulse = this.loader ? this.loader.querySelector(".itm-loader__beam-pulse") : null;
    this.stage = this.loader ? this.loader.querySelector(".itm-loader__stage") : null;
    this.rings = this.loader ? Array.from(this.loader.querySelectorAll(".itm-loader__ring")) : [];
    this.ringHighlight = this.loader ? this.loader.querySelector(".itm-loader__ring-highlight") : null;
    this.serviceItems = this.loader ? Array.from(this.loader.querySelectorAll(".itm-loader__service-item")) : [];
    this.timecode = this.loader ? this.loader.querySelector(".itm-loader__timecode") : null;
    
    // Check elements
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.displayProgress = 0;
    this.targetProgress = 0;
    this.lastAnnounced = -10;
    this.minElapsed = false;
    this.readyResolved = false;
    this.serviceSequenceDone = false;
    this.pendingFinish = false;
    this.finishing = false;
    this.destroyed = false;
    this.progressFrame = null;
    this.maxTimer = null;
    this.minTimer = null;
    this.serviceTimeline = null;
    this.introTimeline = null;
    this.exitTimeline = null;
    this.cleanupTasks = [];
  }

  init() {
    if (!this.loader || !this.pageShell) {
      this.forceShowPage();
      return;
    }

    const hasSeenLoader = sessionStorage.getItem("itm_loader_session_seen") === "true";
    const isReload = !!window.__ITM_LOADER_IS_RELOAD__;
    const showMainLoader = isReload || !hasSeenLoader;

    document.documentElement.classList.add("itm-loader-active");
    this.loader.setAttribute("aria-hidden", "false");
    document.body.setAttribute("aria-busy", "true");

    if (showMainLoader) {
      // Main sophisticated loader flow
      this.setStatus("Loading Imagine Technomedia");

      gsap.set(this.pageShell, { opacity: 0, y: 24 });
      gsap.set(this.progressFill, { scaleX: 0 });

      this.prepareRings();
      this.playIntro();
      this.startServiceSequence();
      this.startProgressLoop();
      this.watchReadiness();
    } else {
      // Simple transition loader flow
      this.setStatus("Transitioning page");

      // Hide all sophisticated loader elements
      const sophElements = this.loader.querySelectorAll(
        '.itm-loader__timecode, .itm-loader__beam-wrap, .itm-loader__inner, .itm-loader__progress, .itm-loader__particles'
      );
      sophElements.forEach(el => el.style.display = 'none');

      // Show the simple spinner
      let spinnerWrap = this.loader.querySelector('.itm-loader__spinner-wrap');
      if (!spinnerWrap) {
        spinnerWrap = document.createElement('div');
        spinnerWrap.className = 'itm-loader__spinner-wrap';
        spinnerWrap.style.cssText = 'position: absolute; display: flex; align-items: center; justify-content: center; z-index: 10;';
        const spinner = document.createElement('div');
        spinner.className = 'itm-loader__spinner';
        spinnerWrap.appendChild(spinner);
        this.loader.appendChild(spinnerWrap);
      }
      spinnerWrap.style.display = 'flex';

      // Fast fadeout when page loads
      const hideSimpleLoader = () => {
        gsap.timeline()
          .to(this.loader, { opacity: 0, duration: 0.35, ease: "power2.out" })
          .call(() => {
            this.destroy();
          });
      };

      if (document.readyState === "complete") {
        setTimeout(hideSimpleLoader, 400);
      } else {
        window.addEventListener("load", hideSimpleLoader);
        setTimeout(hideSimpleLoader, 2000); // Fallback
      }
    }
  }

  forceShowPage() {
    document.documentElement.classList.remove("itm-loader-boot", "itm-loader-active");
    document.body.removeAttribute("aria-busy");
  }

  setStatus(text) {
    if (this.progressStatus) {
      this.progressStatus.textContent = text;
    }
  }

  prepareRings() {
    this.rings.forEach((ring) => {
      const length = ring.getTotalLength();
      gsap.set(ring, {
        strokeDasharray: length,
        strokeDashoffset: length
      });
    });

    if (this.ringHighlight) {
      const highlightLength = this.ringHighlight.getTotalLength();
      gsap.set(this.ringHighlight, {
        strokeDashoffset: 0,
        opacity: 0
      });
      this.ringHighlight.dataset.length = String(highlightLength);
    }
  }

  playIntro() {
    if (this.reducedMotion) {
      gsap.set([this.logoCore, this.logoFull], { opacity: 1, clearProps: "clipPath,transform" });
      gsap.set(this.rings, { strokeDashoffset: 0, opacity: 0.78 });
      gsap.set(this.ringHighlight, { opacity: 0.35 });
      gsap.set(this.timecode, { opacity: 1 });
      this.serviceSequenceDone = true;
      return;
    }

    const ease = "power3.inOut";
    const highlightLength = this.ringHighlight ? Number(this.ringHighlight.dataset.length || 0) : 0;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    this.introTimeline = gsap.timeline();
    this.introTimeline
      .set(this.timecode, { opacity: 0, y: -8 })
      .to(this.beam, { opacity: 1, scaleX: 1, duration: 0.5, ease })
      .to(this.beamPulse, { opacity: 0.65, scaleX: 1, duration: 0.5, ease }, "<")
      .to(this.beamPulse, { opacity: 0.18, scaleX: 1.2, duration: 0.42, ease: "power2.out" })
      .to(this.timecode, { opacity: 1, y: 0, duration: 0.35 }, "<0.1")
      .to(this.rings, {
        strokeDashoffset: 0,
        duration: 0.88,
        stagger: 0.08,
        ease: "power3.out"
      }, "-=0.2")
      .fromTo(this.logoCore,
        { opacity: 0, scaleY: 0.18, transformOrigin: "center center" },
        { opacity: 1, scaleY: 1, duration: 0.56, ease: "power3.out" },
        "-=0.38"
      )
      .to(this.logoCore, {
        filter: "drop-shadow(0 0 22px rgba(255, 16, 16, 0.32))",
        duration: 0.18
      })
      .to(this.logoFull, {
        opacity: 1,
        clipPath: "inset(0 0% 0 0%)",
        duration: 0.52,
        ease: "power3.out"
      }, "-=0.12")
      // Scanning left to right, then right to left!
      .fromTo(this.scan,
        { opacity: 0, xPercent: -80 },
        { opacity: 0.8, xPercent: 84, duration: 0.5, ease: "power2.out" },
        "-=0.46"
      )
      .to(this.scan, { opacity: 0.2, duration: 0.1 })
      .fromTo(this.scan,
        { xPercent: 84 },
        { opacity: 0.8, xPercent: -80, duration: 0.5, ease: "power2.out" }
      )
      .to(this.scan, { opacity: 0, duration: 0.18 })
      .to(this.stage, { scale: isMobile ? 1.01 : 1.025, duration: 0.18, ease: "power2.out" }, "-=0.18")
      .to(this.stage, { scale: 1, duration: 0.26, ease: "power2.out" });

    this.rings.forEach((ring, index) => {
      const duration = 20 + (index * 3);
      this.cleanupTasks.push(gsap.to(ring, {
        rotation: index % 2 === 0 ? 360 : -360,
        svgOrigin: "210 210",
        duration,
        repeat: -1,
        ease: "none",
        delay: 0.45 + (index * 0.06)
      }));
    });

    if (this.ringHighlight && highlightLength) {
      this.cleanupTasks.push(gsap.to(this.ringHighlight, {
        opacity: 0.75,
        duration: 0.3,
        delay: 1.05
      }));
      this.cleanupTasks.push(gsap.to(this.ringHighlight, {
        rotation: 360,
        svgOrigin: "210 210",
        duration: 32,
        repeat: -1,
        ease: "none",
        delay: 1.05
      }));
    }
  }

  startServiceSequence() {
    if (this.reducedMotion || this.serviceItems.length === 0) {
      this.serviceSequenceDone = true;
      return;
    }

    const timeline = gsap.timeline({
      onComplete: () => {
        this.serviceSequenceDone = true;
        this.checkTransitionReady();
      }
    });

    const activeLine = this.loader.querySelector(".itm-loader__service-line");
    if (activeLine) {
      timeline.fromTo(activeLine, { scaleX: 0 }, { scaleX: 1.6, duration: 0.56, ease: "power3.inOut" });
    }

    this.serviceItems.forEach((item, index) => {
      const labelText = item.textContent || "";
      timeline.add(() => {
        this.setStatus(`Calibrating: ${labelText}`);
      }, `-=${index === 0 ? 0 : 0.25}`);

      timeline.fromTo(item,
        { opacity: 0, y: 14, scale: 0.96 },
        { opacity: 0.9, y: 0, scale: 1, duration: 0.42, ease: "power2.out" }
      );
      timeline.to(item,
        { opacity: 0, y: -14, scale: 0.96, duration: 0.36, ease: "power2.in" },
        "+=0.48"
      );
    });

    if (activeLine) {
      timeline.to(activeLine, { scaleX: 0, duration: 0.45, ease: "power3.inOut" }, "-=0.2");
    }

    this.serviceTimeline = timeline;
  }

  startProgressLoop() {
    this.minTimer = setTimeout(() => {
      this.minElapsed = true;
      this.checkTransitionReady();
    }, this.config.minimumDisplayMs);

    this.maxTimer = setTimeout(() => {
      this.readyResolved = true;
      this.minElapsed = true;
      this.serviceSequenceDone = true;
      this.checkTransitionReady();
    }, this.config.maximumDisplayMs);

    const updateProgress = () => {
      if (this.destroyed) return;

      if (this.readyResolved && this.serviceSequenceDone) {
        this.targetProgress = 100;
      } else if (this.serviceSequenceDone) {
        this.targetProgress = Math.min(88, this.targetProgress + 1.2);
      } else {
        this.targetProgress = Math.min(68, this.targetProgress + 0.65);
      }

      this.displayProgress += (this.targetProgress - this.displayProgress) * 0.082;
      const progressInt = Math.min(100, Math.floor(this.displayProgress));

      if (this.progressFill) {
        gsap.set(this.progressFill, { scaleX: progressInt / 100 });
      }
      if (this.progressValue) {
        this.progressValue.textContent = `${progressInt}%`;
      }

      if (progressInt < 100) {
        this.progressFrame = requestAnimationFrame(updateProgress);
      }
    };

    this.progressFrame = requestAnimationFrame(updateProgress);
  }

  watchReadiness() {
    const handleReady = () => {
      this.readyResolved = true;
      this.checkTransitionReady();
    };

    if (document.readyState === "complete") {
      handleReady();
    } else {
      window.addEventListener("load", handleReady);
    }
  }

  checkTransitionReady() {
    if (this.destroyed || this.finishing) return;
    if (this.readyResolved && this.minElapsed && this.serviceSequenceDone) {
      this.startTransitionOut();
    }
  }

  startTransitionOut() {
    this.finishing = true;

    if (this.minTimer) clearTimeout(this.minTimer);
    if (this.maxTimer) clearTimeout(this.maxTimer);
    if (this.progressFrame) cancelAnimationFrame(this.progressFrame);

    if (this.progressFill) gsap.set(this.progressFill, { scaleX: 1 });
    if (this.progressValue) this.progressValue.textContent = "100%";
    this.setStatus("System ready");

    if (this.reducedMotion) {
      this.destroy();
      return;
    }

    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    this.exitTimeline = gsap.timeline({
      onComplete: () => {
        this.destroy();
      }
    });

    this.exitTimeline
      .to(this.loader, { "--itm-loader-aperture": "140vmax", duration: 0.92 }, 0.12)
      .to(this.pageShell, { opacity: 1, y: 0, duration: 0.85, clearProps: "transform" }, 0.28)
      .to(this.loader, { opacity: 0, duration: 0.22 }, 0.82);
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      sessionStorage.setItem("itm_loader_session_seen", "true");
    } catch (e) {}

    document.documentElement.classList.remove("itm-loader-boot", "itm-loader-active");
    document.body.removeAttribute("aria-busy");

    this.cleanupTasks.forEach((task) => {
      if (task && typeof task.kill === "function") {
        task.kill();
      }
    });

    if (this.loader) {
      this.loader.remove();
    }

    if (this.pageShell) {
      gsap.set(this.pageShell, { clearProps: "opacity,transform" });
    }
  }
}
window.ImagineTechnomediaLoader = ImagineTechnomediaLoader;
