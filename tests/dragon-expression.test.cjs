const test=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {sampleEmotion,EMOTION_IDS,EMOTION_NEUTRAL}=require(path.join(process.env.DRAGON_TEST_WEB||path.join(__dirname,'../web'),'pet-dragon-motion.js'));
test('seventeen reference expression states have finite bounded, time-varying motion',()=>{
 assert.equal(EMOTION_IDS.length,17);const fingerprints=new Set();
 for(const id of EMOTION_IDS){const samples=Array.from({length:81},(_,i)=>sampleEmotion(id,i/10));for(const p of samples){assert.ok(Object.values(p).every(Number.isFinite));assert.ok(Math.abs(p.headX)<=3.1&&Math.abs(p.headY)<=2&&Math.abs(p.headZ)<=2);assert.ok(p.headGain>=.2&&p.headGain<=1);assert.ok(p.eyeLCap>=0&&p.eyeLCap<=1&&p.eyeRCap>=0&&p.eyeRCap<=1);}
 assert.ok(samples.some(p=>Math.abs(p.headX)+Math.abs(p.headY)+Math.abs(p.headZ)>.1),id);fingerprints.add(JSON.stringify(samples[17]));}
 assert.equal(fingerprints.size,17);
});
test('sad and gloomy states damp the bouncy idle while playful wink can reopen',()=>{
 assert.ok(sampleEmotion('interrupted',2).headGain<.5);assert.ok(sampleEmotion('gloom',2).headGain<.3);assert.ok(sampleEmotion('working',2).headGain>.8);
 assert.equal(sampleEmotion('playful',0).eyeLAdd,0);assert.ok(sampleEmotion('playful',2).eyeLAdd>.9);
});
test('sampler is stateless, finite on invalid time and continuous over cycle boundaries',()=>{
 assert.deepEqual(sampleEmotion('unknown',1),EMOTION_NEUTRAL);
 for(const id of EMOTION_IDS){assert.ok(Object.values(sampleEmotion(id,NaN)).every(Number.isFinite));assert.deepEqual(sampleEmotion(id,1.25),sampleEmotion(id,1.25));
 for(let t=.01;t<30;t+=.01){const a=sampleEmotion(id,t-.001),b=sampleEmotion(id,t+.001);for(const k of Object.keys(a))assert.ok(Math.abs(a[k]-b[k])<.08,`${id}:${k} discontinuity`);}}
});

test('angry and sad profiles drive their own native brow and mouth details',()=>{
 const angry=sampleEmotion('blocked',1.9),sad=sampleEmotion('interrupted',1.9);
 assert.ok(angry.angryBrow>.3&&angry.angryMouth>.2);assert.equal(angry.sadBrow,0);
 assert.ok(sad.sadBrow>.3&&sad.sadMouth>.1);assert.equal(sad.angryBrow,0);
 assert.ok(sampleEmotion('waiting',.7).open>0,'Surprise needs an opening accent');
});

test('registered native expression files enable surprise once and reset it on every other mood',{
 skip:process.env.DRAGON_TEST_WEB?false:'Set DRAGON_TEST_WEB to the matching model test directory',
},()=>{
 const fs=require('node:fs'),dir=path.join(process.env.DRAGON_TEST_WEB,'appearances/dragon-live');const spec=JSON.parse(fs.readFileSync(path.join(dir,'dragon.states.model3.json')));
 for(const e of spec.FileReferences.Expressions){const data=JSON.parse(fs.readFileSync(path.join(dir,e.File))),v=Object.fromEntries(data.Parameters.map(p=>[p.Id,p.Value]));assert.equal(v.ParamRefineSurprise,e.Name==='waiting'?1:0,e.Name+' surprise gate');if(e.Name==='waiting'){assert.equal(v.ParamRefineMouth,1);assert.ok(Math.abs(v.ParamSurpriseClose-3/14)<1e-8);}}
});

test('review gaze scans with a quiet pause and shy blink follows the glance',()=>{
 for(const id of ['review','round']){assert.ok(sampleEmotion(id,1.6).gazeX>.1);assert.equal(sampleEmotion(id,3.2).gazeX,0);assert.ok(sampleEmotion(id,5.1).gazeX<-.1);}
 assert.ok(sampleEmotion('blush',5.05).eyeLCap<.2);
});
