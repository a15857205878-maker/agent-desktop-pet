// One material family for the supplied house GLB and code-native districts.
export const outdoorPalette=Object.freeze({
 wood:'#b18c66',base:'#9c7858',cream:'#eee4d3',wall:'#f0e8d8',roof:'#cbbda5',
 stone:'#cec5b6',rim:'#e4d8c2',grass:'#9eaf87',leaf:'#829a70',leafShade:'#687f5e',leafLight:'#a4b48a',
 bark:'#8b6d50',soil:'#9b8062',pot:'#ba876b',flower:'#bda0c2',gold:'#dec17e',water:'#96b7bc',
 metal:'#4c4850',glow:'#ffdaa0'
});
export const outdoorLighting=Object.freeze({day:{ambient:1.45,sun:1.8,exposure:.95},night:{ambient:.9,sun:.42,exposure:1.06,street:1.8}});
export function harmonizeHomeMaterials(model){
 const p=outdoorPalette,map={Mat_WallCream:p.wall,Mat_WallBase:p.stone,Mat_RoofTile:p.roof,Mat_RoofTrim:p.wood,Mat_WoodWarm:p.wood,Mat_BaseWood:p.base,Mat_Grass:p.grass,Mat_StonePath:p.stone,Mat_Doormat:p.flower,Mat_Shutter:p.leaf,Mat_Fence:p.wood,Mat_PotClay:p.pot,Mat_PotSoil:p.soil,Mat_PlantLeaf:p.leaf,Mat_FlowerPurple:p.flower,Mat_FlowerYellow:p.gold};
 const seen=new Set();model.traverse(o=>{for(const m of o.material?[o.material].flat():[]){if(seen.has(m)||!map[m.name])continue;seen.add(m);m.color.set(map[m.name]);m.roughness=.86}});
 return seen.size;
}
