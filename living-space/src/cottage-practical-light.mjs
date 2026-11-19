// Local fixture pools supplement the existing moon/sky light without changing it.
// Reuse the scene-owned point lights; this switch allocates no render resources.
export function applyCottagePracticalLights(porch,window,night,isHome){
 const lit=!!night&&!!isHome;
 porch.visible=window.visible=!!isHome;
 porch.color.set('#ffdeb0');porch.distance=2.7;porch.decay=2;porch.intensity=lit?2.1:0;
 window.color.set('#ffe1b8');window.distance=1.85;window.decay=2;window.intensity=lit?.45:0;
}
