const clamp = (v, min = 0, max = 1) => Math.max(min, Math.min(max, v));
const smoothstep = (t) => {
  const p = clamp(t, 0, 1);
  return p * p * (3 - 2 * p);
};

/**
 * Look-back response curve (回头回应):
 * ~0.6s (600ms) turn-in from startWeight -> 1.0,
 * ~1.2s (1200ms) hold at 1.0,
 * ~0.5s (500ms) recover from 1.0 -> 0.0.
 * Total duration: 2300ms.
 */
export function sampleHeadTurn(elapsedMs, startWeight = 0) {
  const w0 = clamp(Number(startWeight) || 0, 0, 1);
  if (elapsedMs < 0) {
    return { turnWeight: w0, phase: 'idle', done: false };
  }
  const turnInMs = 600;
  const holdMs = 1200;
  const recoverMs = 500;
  const totalMs = turnInMs + holdMs + recoverMs; // 2300ms

  if (elapsedMs >= totalMs) {
    return { turnWeight: 0, phase: 'done', done: true };
  }

  if (elapsedMs <= turnInMs) {
    const t = smoothstep(elapsedMs / turnInMs);
    return {
      turnWeight: w0 + (1 - w0) * t,
      phase: 'turn-in',
      done: false
    };
  }

  if (elapsedMs <= turnInMs + holdMs) {
    return {
      turnWeight: 1,
      phase: 'hold',
      done: false
    };
  }

  const recoverElapsed = elapsedMs - (turnInMs + holdMs);
  const t = smoothstep(recoverElapsed / recoverMs);
  return {
    turnWeight: 1 - t,
    phase: 'recover',
    done: false
  };
}

/**
 * Smooth recovery from an interrupted look-back state (~0.5s full scale).
 */
export function sampleHeadReturn(elapsedMs, fromWeight = 1, durationMs = 500) {
  const rawStart = fromWeight === undefined || fromWeight === null ? 1 : Number(fromWeight);
  const start = clamp(Number.isFinite(rawStart) ? rawStart : 0, 0, 1);
  if (start <= 0.001 || durationMs <= 0) {
    return { turnWeight: 0, done: true };
  }
  const effectiveDuration = Math.max(180, durationMs * Math.max(0.4, start));
  if (elapsedMs < 0) {
    return { turnWeight: start, done: false };
  }
  if (elapsedMs >= effectiveDuration) {
    return { turnWeight: 0, done: true };
  }
  const t = smoothstep(elapsedMs / effectiveDuration);
  return {
    turnWeight: start * (1 - t),
    done: false
  };
}

/**
 * Work/Study Focus (工作专注):
 * 2-4s (default 3000ms) bounded low-amplitude head/gaze micro-variation.
 * Never fakes typing or shifts the anchor position.
 */
export function sampleFocus(elapsedMs, durationMs = 3000) {
  const dur = clamp(Number(durationMs) || 3000, 2000, 4000);
  if (elapsedMs < 0) {
    return { active: false, gazeWeight: 0, rotationDelta: 0, stretchDelta: 0, done: false };
  }
  if (elapsedMs >= dur) {
    return { active: false, gazeWeight: 0, rotationDelta: 0, stretchDelta: 0, done: true };
  }
  const progress = elapsedMs / dur;
  const envelope = progress < 0.2
    ? smoothstep(progress / 0.2)
    : progress > 0.8
      ? 1 - smoothstep((progress - 0.8) / 0.2)
      : 1;
  const wave = Math.sin(progress * Math.PI * 2);
  return {
    active: true,
    gazeWeight: envelope * 0.06,
    rotationDelta: envelope * wave * 0.0022,
    stretchDelta: envelope * -0.0025,
    done: false
  };
}

/**
 * Doze / Nap eye closure curve (打盹):
 * Slow ~420ms eye close, holds closed eyes while dozing, ~400ms natural opening if auto-completing.
 */
export function sampleNap(elapsedMs, holdOpenEnded = false) {
  if (elapsedMs < 0) {
    return { eyeCloseWeight: 0, done: false };
  }
  const closeMs = 420;
  if (holdOpenEnded) {
    if (elapsedMs <= closeMs) {
      return { eyeCloseWeight: smoothstep(elapsedMs / closeMs), done: false };
    }
    return { eyeCloseWeight: 1, done: false };
  }

  if (elapsedMs >= 2600) {
    return { eyeCloseWeight: 0, done: true };
  }
  if (elapsedMs <= closeMs) {
    return { eyeCloseWeight: smoothstep(elapsedMs / closeMs), done: false };
  }
  if (elapsedMs <= 2200) {
    return { eyeCloseWeight: 1, done: false };
  }
  return {
    eyeCloseWeight: 1 - smoothstep((elapsedMs - 2200) / 400),
    done: false
  };
}

/**
 * Wake action (唤醒):
 * ~0.4s (400ms) eye opening from actual current eyeCloseWeight (preserving 0 if woken immediately at 0ms)
 * and gentle posture righting back to the current chair seat.
 */
export function sampleWake(elapsedMs, fromEyeWeight = 1, durationMs = 400) {
  const rawFrom = fromEyeWeight === undefined || fromEyeWeight === null ? 1 : Number(fromEyeWeight);
  const start = clamp(Number.isFinite(rawFrom) ? rawFrom : 1, 0, 1);
  const dur = Math.max(200, Number(durationMs) || 400);
  if (elapsedMs < 0) {
    return { eyeCloseWeight: start, stretchDelta: 0, rotationDelta: 0, done: false };
  }
  if (elapsedMs >= dur) {
    return { eyeCloseWeight: 0, stretchDelta: 0, rotationDelta: 0, done: true };
  }
  const p = clamp(elapsedMs / dur, 0, 1);
  const t = smoothstep(p);
  const righting = Math.sin(p * Math.PI) * 0.0032;
  return {
    eyeCloseWeight: start * (1 - t),
    stretchDelta: righting,
    rotationDelta: (1 - t) * 0.0018 * start,
    done: false
  };
}

/**
 * Approach stairs pre-transition convergence (靠近楼梯):
 * Converges active motion and performs a bounded short turn/fade before room switch.
 */
export function sampleStairApproach(elapsedMs, durationMs = 150) {
  const dur = Math.max(80, Number(durationMs) || 150);
  if (elapsedMs <= 0) {
    return { converge: 0, rotationDelta: 0, opacity: 1, done: false };
  }
  if (elapsedMs >= dur) {
    return { converge: 1, rotationDelta: 0.003, opacity: 0.85, done: true };
  }
  const t = smoothstep(elapsedMs / dur);
  return {
    converge: t,
    rotationDelta: t * 0.003,
    opacity: 1 - t * 0.15,
    done: false
  };
}

/**
 * Bed side-lying & shallow sleep curve (床沿准备/坐稳 -> 侧躺落枕 -> 安稳闭眼):
 * Default (1750ms):
 * 0..240ms: fade out cleanly in reading chair (opacity startOpacity -> 0, poseKey: null);
 * 240..660ms: swap at opacity === 0 to bed-edge sitting ('bedSit'), fade in 240..420ms & hold steady;
 * 660..1120ms: settle onto pillow in side-lying ('lying', continuous same bed anchor, eyeCloseWeight 0 -> 0.35);
 * 1120..1750ms: smoothly close eyes into restful side-lying sleep (eyeCloseWeight 0.35 -> 1).
 */
export function sampleLieDown(elapsedMs, durationMs = 1750, alreadyOnBed = false, startOpacity = 1) {
  const dur = Math.max(600, Number(durationMs) || 1750);
  const initOp = clamp(Number.isFinite(Number(startOpacity)) ? Number(startOpacity) : 1, 0, 1);
  if (alreadyOnBed) {
    if (elapsedMs <= 0) {
      return { eyeCloseWeight: 0, opacity: 1, poseKey: 'lying', phase: 'settle', done: false };
    }
    const settleDur = Math.min(380, dur * 0.3);
    if (elapsedMs < settleDur) {
      const w = smoothstep(elapsedMs / settleDur) * 0.35;
      return { eyeCloseWeight: clamp(w, 0, 1), opacity: 1, poseKey: 'lying', phase: 'settle', done: false };
    }
    const eyeW = 0.35 + 0.65 * smoothstep((elapsedMs - settleDur) / Math.max(240, dur * 0.55 - settleDur));
    return { eyeCloseWeight: clamp(eyeW, 0, 1), opacity: 1, poseKey: 'lying', phase: 'sleep', done: false };
  }
  const fadeOutEnd = 240;
  if (elapsedMs <= 0) {
    return { eyeCloseWeight: 0, opacity: initOp, poseKey: null, phase: 'fadeOut', done: false };
  }
  if (elapsedMs < fadeOutEnd) {
    return {
      eyeCloseWeight: 0,
      opacity: initOp * (1 - smoothstep(elapsedMs / fadeOutEnd)),
      poseKey: null,
      phase: 'fadeOut',
      done: false
    };
  }
  if (dur >= 1400) {
    const bedPrepFadeEnd = 420;
    const bedPrepEnd = 660;
    const settleEnd = 1120;
    if (elapsedMs < bedPrepEnd) {
      const op =
        elapsedMs < bedPrepFadeEnd
          ? smoothstep((elapsedMs - fadeOutEnd) / (bedPrepFadeEnd - fadeOutEnd))
          : 1;
      return {
        eyeCloseWeight: 0,
        opacity: op,
        poseKey: 'bedSit',
        phase: 'bedPrep',
        done: false
      };
    }
    if (elapsedMs < settleEnd) {
      const w = smoothstep((elapsedMs - bedPrepEnd) / (settleEnd - bedPrepEnd)) * 0.35;
      return {
        eyeCloseWeight: clamp(w, 0, 1),
        opacity: 1,
        poseKey: 'lying',
        phase: 'settle',
        done: false
      };
    }
    const eyeCloseWeight = 0.35 + 0.65 * smoothstep((elapsedMs - settleEnd) / Math.max(200, dur - settleEnd));
    return {
      eyeCloseWeight: clamp(eyeCloseWeight, 0, 1),
      opacity: 1,
      poseKey: 'lying',
      phase: 'sleep',
      done: false
    };
  }
  const fadeInEnd = 480;
  if (elapsedMs < fadeInEnd) {
    return {
      eyeCloseWeight: 0,
      opacity: smoothstep((elapsedMs - fadeOutEnd) / (fadeInEnd - fadeOutEnd)),
      poseKey: 'lying',
      phase: 'fadeIn',
      done: false
    };
  }
  const eyeCloseWeight = smoothstep((elapsedMs - fadeInEnd) / Math.max(160, dur - fadeInEnd));
  return {
    eyeCloseWeight: clamp(eyeCloseWeight, 0, 1),
    opacity: 1,
    poseKey: 'lying',
    phase: 'sleep',
    done: false
  };
}

/**
 * Bed rise & return to reading chair curve (睁眼 -> 手撑/揉眼坐起 -> 坐稳后返回阅读位):
 * Default (1780ms):
 * 0..320ms: open eyes on bed ('lying', opacity: 1);
 * 320..980ms: push up & rub eyes ('rise', same continuous bed anchor, opacity: 1);
 * 980..1320ms: sit steadily on bed edge ('bedSit', same continuous bed anchor, opacity: 1);
 * 1320..1540ms: fade out from bed edge ('bedSit', opacity: 1 -> 0);
 * 1540..1780ms: swap at opacity === 0 to reading chair ('relax', opacity: 0 -> 1).
 */
export function sampleRise(elapsedMs, fromEyeWeight = 1, durationMs = 1780) {
  const rawFrom = fromEyeWeight === undefined || fromEyeWeight === null ? 1 : Number(fromEyeWeight);
  const start = clamp(Number.isFinite(rawFrom) ? rawFrom : 1, 0, 1);
  const dur = Math.max(900, Number(durationMs) || 1780);
  if (elapsedMs <= 0) {
    return { eyeCloseWeight: start, phase: 'wake', poseKey: 'lying', opacity: 1, done: false };
  }
  if (elapsedMs >= dur) {
    return { eyeCloseWeight: 0, phase: 'reading', poseKey: 'relax', opacity: 1, done: true };
  }
  if (dur >= 1600) {
    const wakeEnd = dur * 0.18; // ~320ms
    const pushUpEnd = dur * 0.55; // ~980ms
    const bedSettleEnd = dur * 0.74; // ~1320ms
    const fadeOutEnd = dur * 0.865; // ~1540ms
    if (elapsedMs < wakeEnd) {
      const t = smoothstep(elapsedMs / wakeEnd);
      return { eyeCloseWeight: start * (1 - t), phase: 'wake', poseKey: 'lying', opacity: 1, done: false };
    }
    if (elapsedMs < pushUpEnd) {
      return { eyeCloseWeight: 0, phase: 'pushUp', poseKey: 'rise', opacity: 1, done: false };
    }
    if (elapsedMs < bedSettleEnd) {
      return { eyeCloseWeight: 0, phase: 'bedSettle', poseKey: 'bedSit', opacity: 1, done: false };
    }
    if (elapsedMs < fadeOutEnd) {
      const t = smoothstep((elapsedMs - bedSettleEnd) / (fadeOutEnd - bedSettleEnd));
      return { eyeCloseWeight: 0, phase: 'fadeOut', poseKey: 'bedSit', opacity: 1 - t, done: false };
    }
    const t = smoothstep((elapsedMs - fadeOutEnd) / (dur - fadeOutEnd));
    return { eyeCloseWeight: 0, phase: 'returnChair', poseKey: 'relax', opacity: t, done: false };
  }
  const p = clamp(elapsedMs / dur, 0, 1);
  if (p < 0.22) {
    const t = smoothstep(p / 0.22);
    return { eyeCloseWeight: start * (1 - t), phase: 'wake', poseKey: 'lying', opacity: 1, done: false };
  }
  if (p < 0.34) {
    const t = smoothstep((p - 0.22) / 0.12);
    return { eyeCloseWeight: 0, phase: 'fadeOutToRise', poseKey: 'lying', opacity: 1 - t, done: false };
  }
  if (p < 0.46) {
    const t = smoothstep((p - 0.34) / 0.12);
    return { eyeCloseWeight: 0, phase: 'rise', poseKey: 'rise', opacity: t, done: false };
  }
  if (p < 0.68) {
    return { eyeCloseWeight: 0, phase: 'rise', poseKey: 'rise', opacity: 1, done: false };
  }
  if (p < 0.83) {
    const t = smoothstep((p - 0.68) / 0.15);
    return { eyeCloseWeight: 0, phase: 'fadeOutToChair', poseKey: 'rise', opacity: 1 - t, done: false };
  }
  const t = smoothstep((p - 0.83) / 0.17);
  return { eyeCloseWeight: 0, phase: 'reading', poseKey: 'relax', opacity: t, done: false };
}

/**
 * Stretch reaction curve (伸懒腰):
 * Bounded ~1.5s stretch with gentle upward lift and return to resting pose.
 */
export function sampleStretch(elapsedMs, durationMs = 1500) {
  const dur = Math.max(600, Number(durationMs) || 1500);
  if (elapsedMs <= 0) {
    return { poseKey: 'stretch', stretchDelta: 0, rotationDelta: 0, opacity: 0.85, done: false };
  }
  if (elapsedMs >= dur) {
    return { poseKey: 'relax', stretchDelta: 0, rotationDelta: 0, opacity: 1, done: true };
  }
  const p = clamp(elapsedMs / dur, 0, 1);
  const arch = Math.sin(p * Math.PI);
  const opacity = p < 0.12 ? 0.72 + 0.28 * (p / 0.12) : p > 0.88 ? 0.72 + 0.28 * ((1 - p) / 0.12) : 1;
  return {
    poseKey: 'stretch',
    stretchDelta: arch * 0.012,
    rotationDelta: Math.sin(p * Math.PI * 2) * 0.004,
    opacity,
    done: false
  };
}

export class NapScheduler {
  constructor() {
    this.state = 'relax'; // 'relax', 'napping'
    this.idleMs = 0;
    this.napElapsedMs = 0;
    this.manualDoze = false;
    this.isGameActive = false;
    this.isHidden = false;
  }

  startManualDoze() {
    this.state = 'napping';
    this.manualDoze = true;
    this.napElapsedMs = 0;
    this.idleMs = 0;
  }

  update(dtMs, inputEvents = []) {
    for (const ev of inputEvents) {
      const isDirectional = ['character_click', 'furniture_select', 'pose_select', 'room_switch', 'wake'].includes(ev.type);
      if (isDirectional) {
        this.state = 'relax';
        this.manualDoze = false;
        this.napElapsedMs = 0;
        this.idleMs = 0;
        return;
      }
    }

    if (this.isGameActive || this.isHidden) {
      return;
    }

    const stepMs = Math.max(0, Number(dtMs) || 0);
    if (this.state === 'relax') {
      this.idleMs += stepMs;
      if (this.idleMs >= 10000) {
        this.state = 'napping';
        this.manualDoze = false;
        this.napElapsedMs = 0;
      }
    } else if (this.state === 'napping') {
      this.napElapsedMs += stepMs;
      const res = sampleNap(this.napElapsedMs, this.manualDoze);
      if (res.done) {
        this.state = 'relax';
        this.manualDoze = false;
        this.napElapsedMs = 0;
        this.idleMs = 0;
      }
    }
  }
}
