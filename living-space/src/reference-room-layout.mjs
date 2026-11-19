/**
 * Authoritative layout contract for the reworked 1F Study and 2F Bedroom scenes
 * aligned to references/APPROVED.jpg.
 *
 * Coordinate convention:
 * - World space: floor bounds x in [-2, 2], z in [-2, 2], floor top y = 0.22, wall top y = 3.0.
 * - Study GLB model (`studyModel`) is X-mirrored at runtime (`model.scale.x = -1`),
 *   so study-local `x = -world x`, `y = world y`, `z = world z`.
 */

export const STUDY_LAYOUT = Object.freeze({
  roomBounds: Object.freeze({
    x: Object.freeze([-2, 2]),
    y: Object.freeze([0, 3]),
    z: Object.freeze([-2, 2]),
    floorTopY: 0.22,
    wallTopY: 3.0
  }),
  window: Object.freeze({
    localCenter: Object.freeze([0.3, 1.8, -1.92]),
    worldCenter: Object.freeze([-0.3, 1.8, -1.92]),
    bottomY: 1.2,
    topY: 2.4,
    width: 1.1,
    localX: Object.freeze([-0.25, 0.85]),
    worldX: Object.freeze([-0.85, 0.25]),
    z: -1.92
  }),
  desk: Object.freeze({
    worldX: Object.freeze([-1.15, 0.55]),
    worldZ: Object.freeze([-1.8, -1.0]),
    tabletopY: 0.94,
    center: Object.freeze([-0.3, 0.94, -1.4]),
    bounds: Object.freeze({
      min: Object.freeze([-1.15, 0.22, -1.8]),
      max: Object.freeze([0.55, 0.94, -1.0])
    })
  }),
  computer: Object.freeze({
    anchor: Object.freeze([-0.8, 1.0, -1.4]),
    bounds: Object.freeze({
      min: Object.freeze([-1.04, 0.94, -1.62]),
      max: Object.freeze([-0.56, 1.44, -1.3])
    })
  }),
  phone: Object.freeze({
    anchor: Object.freeze([-1.03, 0.944, -1.05])
  }),
  deskCompanionBase: Object.freeze([-0.334, 0.74, -0.75]),
  chairBase: Object.freeze([0.55, 0.66, -0.15]),
  chairCenter: Object.freeze([0.74, 0.66, -0.35]),
  chairShadow: Object.freeze([0.55, 0.224, -0.15]),
  chairBounds: Object.freeze({
    min: Object.freeze([0.31, 0.22, -0.78]),
    max: Object.freeze([1.17, 1.04, 0.08]),
    seatWidth: 0.85
  }),
  bookshelf: Object.freeze({
    anchor: Object.freeze([0.55, 1.0, -1.55]),
    bounds: Object.freeze({
      min: Object.freeze([0.12, 0.22, -1.84]),
      max: Object.freeze([0.98, 1.66, -1.48])
    })
  }),
  sideTable: Object.freeze({
    center: Object.freeze([1.0, 0.73, 0.2]),
    tabletopY: 0.75,
    radius: 0.22,
    bounds: Object.freeze({
      min: Object.freeze([0.78, 0.22, -0.02]),
      max: Object.freeze([1.22, 0.75, 0.42])
    })
  }),
  handheldAnchor: Object.freeze([1.0, 0.754, 0.2]),
  stairs: Object.freeze({
    turnType: 'quarter-turn',
    turnAngleDeg: 90,
    centerX: 1.545,
    width: 0.63,
    worldX: Object.freeze([0.23, 1.86]),
    zStart: 1.4,
    zEnd: -1.56,
    yStart: 0.22,
    yEnd: 2.4,
    steps: 13,
    entryPoint: Object.freeze([1.62, 0.58, 1.66]),
    lowerFlight: Object.freeze({
      direction: Object.freeze([1, 0, 0]),
      steps: 5,
      width: 0.64,
      stepRun: 0.2,
      stepRise: (2.4 - 0.22) / 13,
      xStart: 0.23,
      xEnd: 1.23,
      zCenter: 1.08,
      worldX: Object.freeze([0.23, 1.23]),
      worldZ: Object.freeze([0.76, 1.4]),
      yStart: 0.22,
      yEnd: 0.22 + (5 * (2.4 - 0.22)) / 13,
      bounds: Object.freeze({
        min: Object.freeze([0.23, 0.22, 0.76]),
        max: Object.freeze([1.23, 0.22 + (5 * (2.4 - 0.22)) / 13 + 0.54, 1.4])
      })
    }),
    landing: Object.freeze({
      center: Object.freeze([1.545, 0.22 + (5 * (2.4 - 0.22)) / 13, 1.08]),
      size: Object.freeze([0.63, 0.055, 0.64]),
      height: 0.22 + (5 * (2.4 - 0.22)) / 13,
      worldX: Object.freeze([1.23, 1.86]),
      worldZ: Object.freeze([0.76, 1.4]),
      bounds: Object.freeze({
        min: Object.freeze([1.23, 0.22, 0.76]),
        max: Object.freeze([1.86, 0.22 + (5 * (2.4 - 0.22)) / 13 + 0.54, 1.4])
      })
    }),
    upperFlight: Object.freeze({
      direction: Object.freeze([0, 0, -1]),
      steps: 8,
      width: 0.63,
      stepRun: 0.29,
      stepRise: (2.4 - 0.22) / 13,
      xCenter: 1.545,
      zStart: 0.76,
      zEnd: -1.56,
      worldX: Object.freeze([1.23, 1.86]),
      worldZ: Object.freeze([-1.56, 0.76]),
      yStart: 0.22 + (5 * (2.4 - 0.22)) / 13,
      yEnd: 2.4,
      bounds: Object.freeze({
        min: Object.freeze([1.23, 0.22, -1.56]),
        max: Object.freeze([1.86, 2.94, 0.76])
      })
    }),
    path: Object.freeze([
      Object.freeze([0.23, 0.22, 1.08]),
      Object.freeze([1.23, 0.22 + (5 * (2.4 - 0.22)) / 13, 1.08]),
      Object.freeze([1.545, 0.22 + (5 * (2.4 - 0.22)) / 13, 1.08]),
      Object.freeze([1.545, 0.22 + (5 * (2.4 - 0.22)) / 13, 0.76]),
      Object.freeze([1.545, 2.4, -1.56])
    ]),
    bounds: Object.freeze({
      min: Object.freeze([0.23, 0.22, -1.56]),
      max: Object.freeze([1.86, 2.94, 1.4])
    })
  }),
  lamp: Object.freeze({
    groupName: 'reference-study-lamp-glow',
    anchor: Object.freeze([0.18, 1.12, -1.55])
  })
});

export const BEDROOM_LAYOUT = Object.freeze({
  window: Object.freeze({
    center: Object.freeze([-0.46, 1.82, -1.92]),
    bottomY: 1.23,
    topY: 2.41,
    width: 1.18
  }),
  readingChairScale: Object.freeze([0.78, 0.85, 0.8]),
  companionReadingBase: Object.freeze([-1.08, 0.61, -0.44]),
  readingSpriteSizeScale: 0.82,
  bedRestAnchor: Object.freeze([1.14, 0.625, -0.45]),
  stairsPoint: Object.freeze([1.36, 0.24, 1.12])
});
