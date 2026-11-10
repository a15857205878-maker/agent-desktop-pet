
export function sampleHeadTurn(elapsedMs) {
    if (elapsedMs < 0) {
        return { turnWeight: 0, done: false };
    }
    if (elapsedMs >= 2400) {
        return { turnWeight: 0, done: true };
    }
    
    let turnWeight = 0;
    if (elapsedMs <= 200) {
        turnWeight = 0;
    } else if (elapsedMs <= 500) {
        turnWeight = (elapsedMs - 200) / (500 - 200);
    } else if (elapsedMs <= 1900) {
        turnWeight = 1;
    } else if (elapsedMs <= 2200) {
        turnWeight = 1 - (elapsedMs - 1900) / (2200 - 1900);
    } else {
        turnWeight = 0;
    }
    
    return { turnWeight, done: false };
}

export function sampleNap(elapsedMs) {
    if (elapsedMs < 0) {
        return { eyeCloseWeight: 0, done: false };
    }
    if (elapsedMs >= 2300) {
        return { eyeCloseWeight: 0, done: true };
    }
    
    let eyeCloseWeight = 0;
    if (elapsedMs <= 300) {
        eyeCloseWeight = elapsedMs / 300;
    } else if (elapsedMs <= 2000) {
        eyeCloseWeight = 1;
    } else {
        eyeCloseWeight = 1 - (elapsedMs - 2000) / 300;
    }
    
    return { eyeCloseWeight, done: false };
}

export class NapScheduler {
    constructor() {
        this.state = 'relax'; // 'relax', 'napping'
        this.idleMs = 0;
        this.napElapsedMs = 0;
        this.isGameActive = false;
        this.isHidden = false;
    }

    update(dtMs, inputEvents = []) {
        // Handle directional interrupts
        for (const ev of inputEvents) {
            // Only directional operations interrupt/wake up: character_click, furniture_select, pose_select
            const isDirectional = ['character_click', 'furniture_select', 'pose_select'].includes(ev.type);
            if (isDirectional) {
                this.state = 'relax';
                this.napElapsedMs = 0;
                this.idleMs = 0;
                // Input happened this frame: do not immediately add dt again.
                // Reset even before napping, so a recent click prevents dozing.
                return;
            }
            // mousemove, game_input, menu_click, drag are ignored and do NOT wake up or reset idle
        }

        // If game active or hidden, do not start nap and pause idle accumulation
        if (this.isGameActive || this.isHidden) {
            return;
        }

        if (this.state === 'relax') {
            this.idleMs += dtMs;
            if (this.idleMs >= 10000) {
                this.state = 'napping';
                this.napElapsedMs = 0;
            }
        } else if (this.state === 'napping') {
            this.napElapsedMs += dtMs;
            const res = sampleNap(this.napElapsedMs);
            if (res.done) {
                this.state = 'relax';
                this.napElapsedMs = 0;
                this.idleMs = 0; // Reset idle timer to 10s after nap finishes (no immediate re-trigger)
            }
        }
    }
}
