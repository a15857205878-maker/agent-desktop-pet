const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../web/card.js'),'utf8');
function fixture(){
 const nodes=Object.fromEntries(['dot','state','title','elapsed','tools','tokens','source','activity','say'].map(id=>[id,{textContent:'',title:'',style:{}}]));
 const classes=new Set(),events={};
 const document={getElementById:id=>nodes[id],body:{classList:{toggle:(key,value)=>value?classes.add(key):classes.delete(key)}},addEventListener:(name,fn)=>events[name]=fn};
 const window={};vm.runInNewContext(source,{document,window,console});return {nodes,window,classes,events};
}
test('ready handshake and compact replay preserve state',()=>{
 const f=fixture();assert.equal(f.window.__sent[0].t,'hello');
 f.window.__receive({t:'compact',value:true});assert.equal(f.classes.has('compact'),true);
 f.window.__receive({t:'state',data:{title:'示例任务',state:'working',tools:0,elapsed:61}});
 assert.equal(f.nodes.tools.textContent,'0');assert.equal(f.nodes.elapsed.textContent,'1 分 1 秒');
 f.window.__receive({t:'compact',value:false});assert.equal(f.classes.has('compact'),false);assert.equal(f.nodes.title.textContent,'示例任务');
});
test('clamped fields retain full values for native hover reading',()=>{
 const f=fixture(),title='示例长任务标题'.repeat(30),activity='LongUnbrokenActivity'.repeat(20);
 f.window.__receive({t:'state',data:{title,activity,source:'Synthetic Agent',say:'示例说明'}});
 assert.equal(f.nodes.title.textContent,title);assert.equal(f.nodes.title.title,title);
 assert.equal(f.nodes.activity.title,activity);assert.equal(f.nodes.source.title,'Synthetic Agent');
});
test('Escape retains the existing close-card protocol',()=>{
 const f=fixture();f.events.keydown({key:'Escape'});assert.equal(f.window.__sent.at(-1).t,'close-card');
});
