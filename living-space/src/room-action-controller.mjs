import {
  sampleHeadTurn,
  sampleHeadReturn,
  sampleFocus,
  sampleNap,
  sampleWake,
  sampleStairApproach,
  sampleLieDown,
  sampleRise,
  sampleStretch,
  NapScheduler
} from './dragon-action-sampling.mjs';

export const AVAILABLE_COMPANION_ACTIONS = Object.freeze([
  'idle',
  'lookBack',
  'focus',
  'relax',
  'doze',
  'wake',
  'lieDown',
  'rise',
  'stretch'
]);

export function createRoomActionController() {
  const nap = new NapScheduler();
  let head = null; // { elapsed: number, startWeight: number, weight: number }
  let headBack = null; // { from: number, elapsed: number, weight: number }
  let focus = null; // { elapsed: number, duration: number, gazeWeight: number, rotationDelta: number, stretchDelta: number }
  let waking = null; // { from: number, elapsed: number, duration: number, eyeWeight: number, stretchDelta: number, rotationDelta: number }
  let stairApproach = null; // { elapsed: number, duration: number }
  let lying = null; // { elapsed: number, duration: number, eyeWeight: number }
  let rising = null; // { from: number, elapsed: number, duration: number, phase: string, poseKey: string, eyeWeight: number }
  let stretching = null; // { elapsed: number, duration: number, poseKey: string }
  let blinkMs = 0;

  const resetNap = (type = 'pose_select') => {
    nap.update(0, [{ type }]);
    waking = null;
    blinkMs = 0;
  };

  function currentHeadWeight() {
    if (head !== null) return head.weight;
    if (headBack !== null) return headBack.weight;
    return 0;
  }

  function currentEyeCloseWeight(pose) {
    if (waking !== null) return waking.eyeWeight;
    if (nap.state === 'napping') return sampleNap(nap.napElapsedMs, nap.manualDoze).eyeCloseWeight;
    if (pose === 'rest') return 1;
    return 0;
  }

  function clearAllMotions() {
    head = null;
    headBack = null;
    focus = null;
    stairApproach = null;
    lying = null;
    rising = null;
    stretching = null;
  }

  function selectPose() {
    clearAllMotions();
    resetNap('pose_select');
  }

  function cancelAll() {
    clearAllMotions();
    waking = null;
    nap.update(0, [{ type: 'room_switch' }]);
    blinkMs = 0;
  }

  function startIdle() {
    if (head !== null || headBack !== null) {
      returnHead();
    }
    focus = null;
    stairApproach = null;
    lying = null;
    rising = null;
    stretching = null;
    resetNap('pose_select');
  }

  function startHead(initialWeight = null) {
    const startWeight = initialWeight !== null ? initialWeight : currentHeadWeight();
    clearAllMotions();
    resetNap('character_click');
    head = { elapsed: 0, startWeight, weight: startWeight };
  }

  function returnHead() {
    const from = currentHeadWeight();
    head = null;
    if (from <= 0.001) {
      headBack = null;
      return;
    }
    headBack = { from, elapsed: 0, weight: from };
  }

  function startFocus(durationMs = 3000) {
    clearAllMotions();
    resetNap('pose_select');
    focus = {
      elapsed: 0,
      duration: Math.max(2000, Math.min(4000, Number(durationMs) || 3000)),
      gazeWeight: 0,
      rotationDelta: 0,
      stretchDelta: 0
    };
  }

  function startRelax() {
    clearAllMotions();
    resetNap('pose_select');
  }

  function startDoze() {
    clearAllMotions();
    waking = null;
    blinkMs = 0;
    nap.startManualDoze();
  }

  function wake(fallbackEyeWeight = null) {
    const hasExplicitFallback =
      fallbackEyeWeight !== undefined &&
      fallbackEyeWeight !== null &&
      Number.isFinite(Number(fallbackEyeWeight));
    const from = hasExplicitFallback
      ? Math.max(0, Math.min(1, Number(fallbackEyeWeight)))
      : nap.state === 'napping'
        ? sampleNap(nap.napElapsedMs, nap.manualDoze).eyeCloseWeight
        : 0;
    resetNap('wake');
    clearAllMotions();
    waking = {
      from,
      elapsed: 0,
      duration: 400,
      eyeWeight: from,
      stretchDelta: 0,
      rotationDelta: 0
    };
  }

  function startApproachStairs(durationMs = 150) {
    cancelAll();
    stairApproach = { elapsed: 0, duration: durationMs };
  }

  function startLieDown(durationMs = 1750, alreadyOnBed = false, startOpacity = 1, fromBedSeat = false) {
    cancelAll();
    lying = {
      elapsed: fromBedSeat ? 420 : 0,
      duration: Math.max(600, Number(durationMs) || 1750),
      alreadyOnBed: !!alreadyOnBed,
      startOpacity: Math.max(0, Math.min(1, Number.isFinite(Number(startOpacity)) ? Number(startOpacity) : 1)),
      phase: alreadyOnBed ? 'settle' : fromBedSeat ? 'bedPrep' : 'fadeOut',
      poseKey: alreadyOnBed ? 'lying' : fromBedSeat ? 'bedSit' : null,
      eyeWeight: 0
    };
  }

  function startRise(fallbackEyeWeight = null, durationMs = 1780) {
    const hasExplicitFallback =
      fallbackEyeWeight !== undefined &&
      fallbackEyeWeight !== null &&
      Number.isFinite(Number(fallbackEyeWeight));
    const from = hasExplicitFallback
      ? Math.max(0, Math.min(1, Number(fallbackEyeWeight)))
      : lying !== null
        ? lying.eyeWeight
        : 1;
    cancelAll();
    rising = {
      from,
      elapsed: 0,
      duration: Math.max(900, Number(durationMs) || 1780),
      phase: 'wake',
      poseKey: 'lying',
      eyeWeight: from
    };
  }

  function startStretch(durationMs = 1500) {
    head = null;
    headBack = null;
    focus = null;
    waking = null;
    stairApproach = null;
    lying = null;
    rising = null;
    resetNap('pose_select');
    stretching = {
      elapsed: 0,
      duration: Math.max(600, Number(durationMs) || 1500),
      poseKey: 'stretch'
    };
  }

  function step(dt, c = {}) {
    const frozen = !c.motionEnabled || !!c.reducedMotion || !!c.gameActive || !!c.hidden || !!c.menuOpen || !!c.townActive;
    const elapsed = frozen ? 0 : Math.max(0, Number(dt) || 0);

    let headWeight = null;
    let headFinished = false;
    let eyeWeight = null;
    let wakeFinished = false;
    let focusSample = null;
    let stairSample = null;
    let lieSample = null;
    let riseSample = null;
    let riseFinished = false;
    let stretchSample = null;
    let stretchFinished = false;

    if (stairApproach !== null) {
      stairApproach.elapsed += elapsed;
      stairSample = sampleStairApproach(stairApproach.elapsed, stairApproach.duration);
      if (stairSample.done) {
        stairApproach = null;
      }
    }

    if (lying !== null) {
      lying.elapsed += elapsed;
      lieSample = sampleLieDown(lying.elapsed, lying.duration, lying.alreadyOnBed, lying.startOpacity);
      lying.phase = lieSample.phase;
      lying.poseKey = lieSample.poseKey;
      lying.eyeWeight = lieSample.eyeCloseWeight;
      eyeWeight = lieSample.eyeCloseWeight;
    }

    if (rising !== null) {
      rising.elapsed += elapsed;
      riseSample = sampleRise(rising.elapsed, rising.from, rising.duration);
      rising.phase = riseSample.phase;
      rising.poseKey = riseSample.poseKey;
      rising.eyeWeight = riseSample.eyeCloseWeight;
      eyeWeight = riseSample.eyeCloseWeight;
      if (riseSample.done) {
        rising = null;
        riseFinished = true;
      }
    }

    if (stretching !== null) {
      stretching.elapsed += elapsed;
      stretchSample = sampleStretch(stretching.elapsed, stretching.duration);
      stretching.poseKey = stretchSample.poseKey;
      if (stretchSample.done) {
        stretching = null;
        stretchFinished = true;
      }
    }

    if (head !== null) {
      head.elapsed += elapsed;
      const h = sampleHeadTurn(head.elapsed, head.startWeight);
      head.weight = h.turnWeight;
      headWeight = h.turnWeight;
      if (h.done) {
        head = null;
        headFinished = true;
      }
    } else if (headBack !== null) {
      headBack.elapsed += elapsed;
      const r = sampleHeadReturn(headBack.elapsed, headBack.from, 500);
      headBack.weight = r.turnWeight;
      headWeight = r.turnWeight;
      if (r.done) {
        headBack = null;
        headFinished = true;
      }
    }

    if (focus !== null) {
      focus.elapsed += elapsed;
      const f = sampleFocus(focus.elapsed, focus.duration);
      focus.gazeWeight = f.gazeWeight;
      focus.rotationDelta = f.rotationDelta;
      focus.stretchDelta = f.stretchDelta;
      focusSample = f;
      if (f.done) {
        focus = null;
      }
    }

    if (!frozen) {
      const inChairPose = c.pose === 'relax' || c.pose === 'rest';
      if (lying !== null || rising !== null || stretching !== null) {
        // Dedicated bed/stretch actions own the eye/pose pipeline while active
      } else if (!inChairPose || c.demoEnabled || c.transitioning) {
        if (!nap.manualDoze && waking === null) {
          resetNap();
        }
      } else if (waking !== null) {
        waking.elapsed += elapsed;
        const w = sampleWake(waking.elapsed, waking.from, waking.duration);
        waking.eyeWeight = w.eyeCloseWeight;
        waking.stretchDelta = w.stretchDelta;
        waking.rotationDelta = w.rotationDelta;
        eyeWeight = w.eyeCloseWeight;
        if (w.done) {
          waking = null;
          wakeFinished = true;
        }
      } else {
        nap.isGameActive = false;
        nap.isHidden = false;
        nap.update(elapsed);
        if (nap.state === 'napping') {
          blinkMs = 0;
        } else {
          blinkMs += elapsed;
        }
      }
    }

    if (eyeWeight === null && waking !== null) {
      const w = sampleWake(waking.elapsed, waking.from, waking.duration);
      eyeWeight = w.eyeCloseWeight;
    }
    if (eyeWeight === null && nap.state === 'napping') {
      eyeWeight = sampleNap(nap.napElapsedMs, nap.manualDoze).eyeCloseWeight;
    }

    const stretchDelta = (focusSample?.stretchDelta || 0) + (waking?.stretchDelta || 0) + (stretchSample?.stretchDelta || 0);
    const rotationDelta = (focusSample?.rotationDelta || 0) + (waking?.rotationDelta || 0) + (stairSample?.rotationDelta || 0) + (stretchSample?.rotationDelta || 0);

    return {
      headWeight,
      headFinished,
      eyeWeight,
      wakeFinished,
      focusGazeWeight: focusSample ? focusSample.gazeWeight : null,
      stretchDelta,
      rotationDelta,
      stairOpacity: stairSample ? stairSample.opacity : null,
      lieSample,
      riseSample,
      riseFinished,
      stretchSample,
      stretchFinished,
      frozen
    };
  }

  function getActiveActionName(pose = 'back') {
    if (stairApproach !== null) return 'approachStairs';
    if (rising !== null) return 'rise';
    if (lying !== null || pose === 'lying' || pose === 'bedSit') return 'lieDown';
    if (stretching !== null || pose === 'stretch') return 'stretch';
    if (waking !== null) return 'wake';
    if (head !== null || headBack !== null || pose === 'turn') return 'lookBack';
    if (focus !== null) return 'focus';
    if (nap.state === 'napping' || pose === 'rest') return 'doze';
    if (pose === 'relax') return 'relax';
    return 'idle';
  }

  return {
    selectPose,
    cancelAll,
    startIdle,
    startHead,
    returnHead,
    startFocus,
    startRelax,
    startDoze,
    wake,
    startApproachStairs,
    startLieDown,
    startRise,
    startStretch,
    step,
    currentHeadWeight,
    currentEyeCloseWeight,
    getActiveActionName,
    isHeadTurning: () => head !== null || headBack !== null,
    isFocusing: () => focus !== null,
    isNapping: () => nap.state === 'napping',
    isWaking: () => waking !== null,
    isLying: () => lying !== null,
    isRising: () => rising !== null,
    isStretching: () => stretching !== null,
    getState: () => ({
      headElapsedMs: head ? head.elapsed : null,
      headWeight: currentHeadWeight(),
      returningHead: !!headBack,
      focusing: !!focus,
      focusElapsedMs: focus ? focus.elapsed : null,
      nap: nap.state,
      manualDoze: nap.manualDoze,
      idleMs: nap.idleMs,
      napElapsedMs: nap.napElapsedMs,
      waking: !!waking,
      wakeFrom: waking ? waking.from : null,
      wakeElapsedMs: waking ? waking.elapsed : null,
      lying: !!lying,
      liePhase: lying ? lying.phase : null,
      lieElapsedMs: lying ? lying.elapsed : null,
      lieEyeWeight: lying ? lying.eyeWeight : null,
      rising: !!rising,
      risePhase: rising ? rising.phase : null,
      riseElapsedMs: rising ? rising.elapsed : null,
      stretching: !!stretching,
      stretchElapsedMs: stretching ? stretching.elapsed : null,
      approachingStairs: !!stairApproach,
      blinkMs
    })
  };
}
