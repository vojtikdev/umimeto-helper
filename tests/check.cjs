const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const base = path.join(__dirname, '..');
function worker(overrides={},mockFetch) {
  let listener, sent, fetches=0;const calls=[],permissions=[];
  const storage={apiKey:'test-key', ...overrides};
  const context=vm.createContext({URL, crypto:require('node:crypto').webcrypto, AbortSignal, AbortController, setTimeout, clearTimeout, console,
    chrome:{runtime:{id:'test',onConnect:{addListener(){}},onMessage:{addListener(fn){listener=fn}},openOptionsPage:async()=>{}}, action:{onClicked:{addListener(){}}},
      storage:{onChanged:{addListener(){}},local:{setAccessLevel:async()=>{},get:async defaults=>({...defaults,...storage}),set:async value=>Object.assign(storage,value)}},permissions:{contains:async p=>{permissions.push(p);return true;}}},
    fetch:async(url, options)=>{fetches++; calls.push({url,options});sent=options.body?JSON.parse(options.body):undefined;if(mockFetch)return mockFetch(url,options); return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify({answer:'4',explanation:'Two plus two.',choiceIndexes:[1,1,99,-1,'0'],uncertain:false})}}]})};}
  });
  context.importScripts = (...names) => names.forEach(name=>vm.runInContext(fs.readFileSync(path.join(base,name),'utf8'),context));
  vm.runInContext(fs.readFileSync(path.join(base,'background.js'),'utf8'),context);
  return {send:(msg,url='https://www.umimematiku.cz/practice')=>new Promise(resolve=>listener(msg,{id:'test',url,tab:{id:1}},resolve)),get sent(){return sent},get fetches(){return fetches},calls,permissions,storage};
}
test('solver validates input, returns choices and never sends page URL or API key as prompt',async()=>{
  const w=worker(); const r=await w.send({type:'solve',question:'2 + 2 = ?',choices:['3','4']});
  assert.equal(r.result.answer,'4');assert.deepEqual(Array.from(r.result.choiceIndexes),[1]);assert.equal(w.fetches,1);assert.equal(r.result.uncertain,true);
  assert.equal(JSON.stringify(w.sent).includes('test-key'),false);assert.equal(JSON.stringify(w.sent).includes('umimematiku.cz'),false);
});
test('credentials are omitted from public settings',async()=>{
  const w=worker();const r=await w.send({type:'settings'});assert.equal(r.settings.configured,true);assert.equal(r.settings.apiKey,undefined);assert.equal(r.settings.endpoint,undefined);
});
test('reject untrusted senders, empty questions and non-HTTPS API endpoints',async()=>{
  const w=worker();assert.match((await w.send({type:'settings'},'https://umimematiku.cz.evil.test')).error,/Unsupported/);
  assert.match((await w.send({type:'solve',question:'',choices:[]})).error,/Enter a question/);
  const bad=worker({endpoint:'http://example.com/v1/chat/completions'});assert.match((await bad.send({type:'solve',question:'x',choices:[]})).error,/HTTPS/);assert.equal(bad.fetches,0);
});
test('missing API key explains setup without a request',async()=>{
  const w=worker({apiKey:''});assert.match((await w.send({type:'solve',question:'x',choices:[]})).error,/API key/);assert.equal(w.fetches,0);
});
test('browser detects live-shaped DOM, solves, ignores stale results, and saves settings',{skip:!process.env.RUN_BROWSER_TESTS},async()=>{
  const {chromium}=require('playwright');
  const browser=await chromium.launch({headless:true,executablePath:process.env.TEST_CHROMIUM || undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
  try {
    const page=await browser.newPage();
    await page.goto('about:blank');
    await page.evaluate(()=>{
      const original=Element.prototype.attachShadow;Element.prototype.attachShadow=function(o){return original.call(this,{...o,mode:'open'});};
      window.settings={};window.requests=[];window.delay=0;
      globalThis.chrome={runtime:{connect:()=>({onMessage:{addListener(fn){window.settingChange=fn;}}}),sendMessage:async m=>{
        if(m.type==='settings')return {settings:{...Umime.publicSettings(Umime.defaults),...window.settings}};
        if(m.type==='solve'){requests.push(m);await new Promise(r=>setTimeout(r,window.delay));return {result:{answer:'4',explanation:'2 + 2 = 4',choiceIndexes:[1],uncertain:false}};}
      }}};
    });
    await page.setContent('<main><div class="question-content">2 + 2 = ?</div><div class="options"><span class="card" data-data="option">3</span><span class="card" data-data="option">4</span></div><div hidden class="question-content">Do not extract</div></main>');
    for(const name of ['shared.js','extract.js','images.js','panel-theme.js','content.js'])await page.addScriptTag({path:path.join(base,name)});
    const q=page.locator('#umime-helper-extension #question');
    await page.waitForFunction(()=>document.querySelector('#umime-helper-extension').shadowRoot.querySelector('#question').value==='2 + 2 = ?');
    assert.equal(await q.inputValue(),'2 + 2 = ?');
    assert.equal(await page.locator('#umime-helper-extension #choices').inputValue(),'3\n4');
    await page.locator('#umime-helper-extension #ask').click();
    await page.locator('#umime-helper-extension #answer').waitFor({state:'visible'});
    assert.equal(await page.locator('#umime-helper-extension #answer').innerText(),'4');
    await page.evaluate(()=>document.querySelector('.question-content').textContent='5 + 5 = ?');
    await page.waitForFunction(()=>document.querySelector('#umime-helper-extension').shadowRoot.querySelector('#question').value==='5 + 5 = ?');
    assert.equal(await page.locator('#umime-helper-extension #result').isVisible(),false);
    await page.evaluate(()=>window.delay=1200);
    await page.locator('#umime-helper-extension #ask').click();
    await page.locator('#umime-helper-extension #source').evaluate(el=>el.open=true);
    await q.fill('Manual change');
    await page.waitForFunction(()=>!document.querySelector('#umime-helper-extension').shadowRoot.querySelector('#ask').disabled);
    assert.equal(await page.locator('#umime-helper-extension #result').isVisible(),false);
    await page.evaluate(()=>document.querySelector('.question-content').textContent='New exercise');
    await page.waitForFunction(()=>document.querySelector('#umime-helper-extension').shadowRoot.querySelector('#status').textContent.includes('Your edits are kept'));
    assert.equal(await q.inputValue(),'Manual change');
    await page.locator('#umime-helper-extension #scan').click();assert.equal(await q.inputValue(),'New exercise');
    await page.evaluate(()=>{window.settings={theme:'light',position:'left',fontSize:18};window.settingChange({},'local');});
    await page.waitForFunction(()=>document.getElementById('umime-helper-extension').style.left==='18px');
    assert.equal(await page.evaluate(()=>document.getElementById('umime-helper-extension').style.fontSize),'18px');
    await page.locator('#umime-helper-extension #close').click();assert.equal(await q.isVisible(),false);
    await page.locator('#umime-helper-extension #launcher').click();assert.equal(await q.isVisible(),true);
    // Check options with mocked extension APIs, including optional host permission.
    const options=await browser.newPage();
    await options.addInitScript(()=>{globalThis.chrome={storage:{local:{setAccessLevel:async()=>{},get:async defaults=>({...defaults,apiKey:'abc'}),set:async s=>window.saved=s}},permissions:{request:async x=>{window.permission=x;return true;}}};});
    await options.goto('file://'+path.join(base,'options.html'));
    await options.locator('#model').fill('custom-model');
    await options.locator('#endpoint').fill('https://example.com/v1/chat/completions');
    await options.locator('button[type=submit]').click();
    await options.waitForFunction(()=>window.saved?.model==='custom-model');
    assert.equal(await options.evaluate(()=>permission.origins[0]),'https://example.com/*');
    await options.locator('#deleteProfile').click();await options.locator('#deleteProfile').click();assert.equal(await options.locator('#apiKey').inputValue(),'');
    await options.screenshot({path:path.join(base,'tests','settings-preview.png'),fullPage:true});
  } finally {await browser.close();}
});
test('DOM interaction: detection, solve, edits, new questions, settings and minimizing',async()=>{
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<main><div class="question-content">2 + 2 = ?</div><div class="options"><span data-data="option">3</span><span data-data="option">4</span></div><div hidden class="question-content">hidden</div></main>',{runScripts:'outside-only',url:'https://www.umimematiku.cz/practice'});
  const w=dom.window; let updateSettings, override={}, deferred, calls=0;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{width:100,height:20}];};
  const original=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(o){return original.call(this,{...o,mode:'open'});};
  w.chrome={runtime:{connect:()=>({onMessage:{addListener(fn){updateSettings=fn;}}}),sendMessage:async m=>{
    if(m.type==='settings')return {settings:{...w.Umime.publicSettings(w.Umime.defaults),panelStart:'panel',hintFirst:false,...override}};
    if(m.type==='solve'){calls++; if(deferred)await deferred; return {result:{answer:'4',explanation:'Two plus two.',choiceIndexes:[1],uncertain:false}};}
  }}};
  const tick=ms=>new Promise(r=>setTimeout(r,ms));
  try{
    for(const file of ['shared.js','extract.js','images.js','panel-theme.js','content.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
    await tick(20);
    const root=w.document.getElementById('umime-helper-extension').shadowRoot;
    const $=id=>root.getElementById(id);
    assert.equal($('question').value,'2 + 2 = ?');assert.equal($('choices').value,'3\n4');
    $('ask').click();await tick(20);assert.equal($('answer').textContent,'4');assert.equal($('result').hidden,false);assert.equal(calls,1);
    w.document.querySelector('.question-content').textContent='5 + 5 = ?';await tick(500);
    assert.equal($('question').value,'5 + 5 = ?');assert.equal($('result').hidden,true);assert.equal(calls,1);
    let finish;deferred=new Promise(r=>finish=r);$('ask').click();
    $('question').value='Manual edit';$('question').dispatchEvent(new w.Event('input'));finish();await tick(20);
    assert.equal($('result').hidden,true);
    w.document.querySelector('.question-content').textContent='New exercise';await tick(500);
    assert.equal($('question').value,'Manual edit');assert.match($('status').textContent,/Your edits are kept/);
    $('scan').click();assert.equal($('question').value,'New exercise');
    override={theme:'light',position:'left',fontSize:18};updateSettings();await tick(20);
    const host=w.document.getElementById('umime-helper-extension');assert.equal(host.style.left,'18px');assert.equal(host.style.fontSize,'18px');
    $('close').click();assert.equal($('panel').hidden,true);$('launcher').click();assert.equal($('panel').hidden,false);
  }finally{dom.window.close();}
});
async function optionsFixture(initial={}){
  const {JSDOM}=require('jsdom');const state={apiKey:'legacy-secret',...initial},requests=[],permissions=[];
  const dom=new JSDOM(fs.readFileSync(path.join(base,'options.html'),'utf8'),{runScripts:'outside-only',url:'https://extension.test'});
  const w=dom.window;w.matchMedia=()=>({matches:false,addEventListener(){}});w.confirm=()=>true;
  w.chrome={runtime:{getManifest:()=>({version:'2.0.0'}),sendMessage:async m=>{if(m.type==='history')return {entries:state.historyEntries||[]};if(m.type==='usage')return {usage:{day:'2026-10-19',today:{requests:0,input:0,output:0,cached:0,reported:0,unknown:0,failed:0},days:{}}};requests.push(m);return m.type==='listModels'?{models:['local-model','other-model']}:{ok:true,model:m.profile.model,elapsedMs:120};}},storage:{local:{setAccessLevel:async()=>{},get:async defaults=>({...defaults,...state}),set:async s=>Object.assign(state,s)}},permissions:{contains:async()=>true,request:async p=>{permissions.push(p);return true;}}};
  w.eval(fs.readFileSync(path.join(base,'shared.js'),'utf8'));w.eval(fs.readFileSync(path.join(base,'presets.js'),'utf8'));w.eval(fs.readFileSync(path.join(base,'options.js'),'utf8'));await new Promise(r=>setTimeout(r,20));
  return {w,state,requests,permissions,$:id=>w.document.getElementById(id),close:()=>w.close(),submit(id){w.document.getElementById(id).dispatchEvent(new w.Event('submit',{cancelable:true}));}};
}
test('settings migrate legacy credentials, save separate profiles, discover models and test connections',async()=>{
  const f=await optionsFixture();try{
    assert.equal(f.$('apiKey').value,'legacy-secret');f.$('model').value='custom-model';f.submit('settings');await wait(20);
    assert.equal(f.state.profiles[0].apiKey,'legacy-secret');assert.equal(f.state.apiKey,'');assert.equal(f.state.activeProfileId,'legacy');
    f.$('newProfile').click();f.$('provider').value='ollama';f.$('provider').dispatchEvent(new f.w.Event('change',{bubbles:true}));
    assert.equal(f.$('apiKey').value,'');assert.equal(f.$('auth').value,'none');assert.equal(f.$('apiKey').disabled,true);
    f.$('fetchModels').click();await wait(20);assert.equal(f.$('modelList').children.length,2);assert.equal(f.permissions.at(-1).origins[0],'http://localhost/*');
    f.$('model').value='local-model';f.$('testConnection').click();await wait(20);assert.match(f.$('status').textContent,/Connection works/);
    f.submit('settings');await wait(20);assert.equal(f.state.profiles.length,2);assert.equal(f.state.profiles[1].noKey,true);assert.equal(f.state.profiles[0].apiKey,'legacy-secret');
    assert.equal(f.state.profiles[1].endpoint,'http://localhost:11434/v1/chat/completions');
    f.w.document.querySelector('.profile-card .use').click();await wait(20);assert.equal(f.state.activeProfileId,'legacy');
    f.$('showKey').click();assert.equal(f.$('apiKey').type,'text');
  }finally{f.close();}
});
test('settings navigation, preview, preference validation and profile deletion preserve boundaries',async()=>{
  const f=await optionsFixture();try{
    f.submit('settings');await wait(20);const key=f.state.profiles[0].apiKey;
    f.w.document.querySelector('[data-tab=appearance]').click();assert.equal(f.$('tab-appearance').hidden,false);assert.equal(f.$('tab-models').hidden,true);assert.equal(f.$('savebar').hidden,false);
    f.$('theme').value='light';f.$('theme').dispatchEvent(new f.w.Event('change',{bubbles:true}));assert.equal(f.w.document.documentElement.dataset.theme,'light');
    f.$('panelWidth').value='450';f.submit('preferences');await wait(20);assert.equal(f.state.panelWidth,450);assert.equal(f.state.profiles[0].apiKey,key);
    f.$('questionSelector').value='[';f.$('panelWidth').value='460';f.submit('preferences');await wait(20);assert.equal(f.state.panelWidth,450);assert.equal(f.$('status').dataset.error,'true');
    f.$('reset').click();await wait(20);assert.equal(f.state.panelWidth,380);assert.equal(f.state.profiles[0].apiKey,key);
    f.$('deleteProfile').click();assert.equal(f.state.profiles.length,1);f.$('deleteProfile').click();await wait(20);assert.equal(f.state.profiles.length,0);assert.equal(f.state.apiKey,'');assert.equal(f.state.autoSolve,false);
  }finally{f.close();}
});

async function automationFixture(overrides={}, solver){
  const {JSDOM}=require('jsdom');
  const dom=new JSDOM('<main><div class="question-content">2 + 2 = ?</div><div class="options"><button data-data="option">3</button><button data-data="option">4</button></div></main>',{runScripts:'outside-only',pretendToBeVisual:true,url:'https://www.umimematiku.cz/practice'});
  const w=dom.window;let settings={configured:true,autoSolve:true,autoClick:true,autoDelay:500,hintFirst:false,panelStart:'panel',...overrides}, calls=[],clicks=[],update,panelListener;
  w.matchMedia=()=>({matches:false,addEventListener(){}});
  w.Element.prototype.getClientRects=function(){return this.closest('[hidden]')?[]:[{width:100,height:20}];};
  const original=w.Element.prototype.attachShadow;w.Element.prototype.attachShadow=function(o){return original.call(this,{...o,mode:'open'});};
  w.document.querySelectorAll('[data-data=option]').forEach(el=>el.onclick=()=>clicks.push(el.textContent));
  w.chrome={runtime:{id:'test',onMessage:{addListener(fn){panelListener=fn;}},connect:()=>({onMessage:{addListener(fn){update=fn;}}}),sendMessage:async m=>{
    if(m.type==='settings')return {settings:{...w.Umime.publicSettings(w.Umime.defaults),...settings}};
    if(m.type==='setAutoSolve'){settings.autoSolve=m.enabled;return {};}
    if(m.type==='setActiveProfile'){settings.activeProfileId=m.id;settings.solverIdentity=m.id;settings.modelLabel=settings.profiles.find(p=>p.id===m.id)?.model;return {};}
    if(m.type==='solve'){calls.push(m);return solver?solver(m):{result:{answer:'4',explanation:'Two plus two.',choiceIndexes:[1],uncertain:false}};}
  }}};
  for(const name of ['shared.js','extract.js','images.js','panel-theme.js','content.js'])w.eval(fs.readFileSync(path.join(base,name),'utf8'));
  await new Promise(r=>setTimeout(r,20));
  const root=w.document.getElementById('umime-helper-extension').shadowRoot;
  return {w, calls, clicks,panel(action){let response;panelListener({type:'panelAction',action},{id:'test'},r=>response=r);return response;}, $:id=>root.getElementById(id),close:()=>dom.window.close(),change(s){settings={...settings,...s};update({solverChanged:false});}};
}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
test('auto answers and clicks once; unrelated DOM changes do not duplicate requests; repeats use cache',async()=>{
  const f=await automationFixture();try{
    await wait(600);assert.equal(f.calls.length,1);assert.deepEqual(f.clicks,['4']);assert.equal(f.$('result').hidden,false);
    f.w.document.body.append(f.w.document.createElement('aside'));await wait(950);assert.equal(f.calls.length,1);assert.equal(f.clicks.length,1);
    f.w.document.querySelector('.question-content').textContent='Which result equals two plus two?';await wait(1000);assert.equal(f.calls.length,2);assert.equal(f.clicks.length,2);
    f.w.document.querySelector('.question-content').textContent='2 + 2 = ?';await wait(1000);assert.equal(f.calls.length,2);assert.equal(f.clicks.length,3);
  }finally{f.close();}
});
test('auto off cancels queued request; hidden tabs and manual edits do not auto request',async()=>{
  const f=await automationFixture();try{
    f.$('auto').click();await wait(620);assert.equal(f.calls.length,0);
    Object.defineProperty(f.w.document,'visibilityState',{configurable:true,value:'hidden'});
    f.change({autoSolve:true});await wait(620);assert.equal(f.calls.length,0);
    Object.defineProperty(f.w.document,'visibilityState',{configurable:true,value:'visible'});
    f.w.document.dispatchEvent(new f.w.Event('visibilitychange'));
    f.$('question').value='Manual context';f.$('question').dispatchEvent(new f.w.Event('input'));await wait(620);assert.equal(f.calls.length,0);
  }finally{f.close();}
});
test('uncertainty, multiple suggested choices, and duplicate text prevent auto-click',async()=>{
  for(const config of [{uncertain:true,indexes:[1]},{uncertain:false,indexes:[0,1]},{uncertain:false,indexes:[1],duplicate:true}]){
    const f=await automationFixture({},async()=>({result:{answer:'4',explanation:'Check.',choiceIndexes:config.indexes,uncertain:config.uncertain}}));
    try{if(config.duplicate){const el=f.w.document.createElement('button');el.dataset.data='option';el.textContent='4';f.w.document.querySelector('.options').append(el);}await wait(1000);assert.equal(f.calls.length,1);assert.equal(f.clicks.length,0);}
    finally{f.close();}
  }
});
test('a response racing a new question cannot click or display the old answer',async()=>{
  let resolve;
  const f=await automationFixture({},()=>new Promise(r=>resolve=r));try{
    await wait(600);assert.equal(f.calls.length,1);
    f.w.document.querySelector('.question-content').textContent='Next question';
    resolve({result:{answer:'OLD',explanation:'old',choiceIndexes:[1],uncertain:false}});
    await wait(50);assert.equal(f.clicks.length,0);assert.equal(f.$('result').hidden,true);
    f.change({autoSolve:false});
  }finally{f.close();}
});
test('API failure pauses automatic requests and explicit resume permits one retry',async()=>{
  const f=await automationFixture({},async()=>({error:'API quota or rate limit reached.'}));try{
    await wait(600);assert.equal(f.calls.length,1);assert.equal(f.$('auto').textContent,'Resume auto');
    f.w.document.body.append(f.w.document.createElement('aside'));await wait(950);assert.equal(f.calls.length,1);
    f.$('auto').click();await wait(600);assert.equal(f.calls.length,2);assert.equal(f.clicks.length,0);
  }finally{f.close();}
});
test('image context blocks automatic solving; disabled choices block clicking',async()=>{
  const f=await automationFixture();try{
    f.w.document.querySelector('.question-content').append(f.w.document.createElement('img'));await wait(1000);assert.equal(f.calls.length,0);
    f.w.document.querySelector('img').remove();f.w.document.querySelectorAll('[data-data=option]')[1].disabled=true;
    await wait(1000);assert.equal(f.calls.length,1);assert.equal(f.clicks.length,0);
  }finally{f.close();}
});
test('automation toggle accepts only an explicit boolean and persists it',async()=>{
  const w=worker();await w.send({type:'setAutoSolve',enabled:true});assert.equal((await w.send({type:'settings'})).settings.autoSolve,true);
  assert.match((await w.send({type:'setAutoSolve',enabled:'yes'})).error,/Invalid automation/);
});

test('saved profiles route requests to the selected provider without exposing any stored keys',async()=>{
  const profiles=[{id:'a',name:'Cloud A',endpoint:'https://a.example/v1',model:'model-a',apiKey:'secret-A'},{id:'b',name:'Cloud B',endpoint:'https://b.example/v1/chat/completions',model:'model-b',apiKey:'secret-B'}];
  const w=worker({profiles,activeProfileId:'b'});
  const publicData=await w.send({type:'settings'});assert.equal(publicData.settings.modelLabel,'model-b');assert.equal(JSON.stringify(publicData).includes('secret-'),false);
  await w.send({type:'solve',question:'x',choices:['a','b']});assert.equal(w.calls[0].url,'https://b.example/v1/chat/completions');assert.equal(w.calls[0].options.headers.Authorization,'Bearer secret-B');assert.equal(w.sent.model,'model-b');
  await w.send({type:'setActiveProfile',id:'a'});await w.send({type:'solve',question:'x',choices:['a','b']});assert.equal(w.calls[1].options.headers.Authorization,'Bearer secret-A');assert.equal(w.sent.model,'model-a');
  assert.match((await w.send({type:'setActiveProfile',id:'missing'})).error,/no longer exists/);
});
test('keyless local profiles use loopback permission and omit authentication',async()=>{
  const w=worker({profiles:[{id:'local',name:'Local',endpoint:'http://localhost:11434/v1',model:'local-model',noKey:true}],activeProfileId:'local'});
  assert.equal((await w.send({type:'settings'})).settings.configured,true);
  await w.send({type:'solve',question:'x',choices:['a','b']});assert.equal(w.calls[0].url,'http://localhost:11434/v1/chat/completions');assert.equal(w.calls[0].options.headers.Authorization,undefined);assert.equal(w.permissions[0].origins[0],'http://localhost/*');
});
test('model discovery is settings-only and normalizes an API base URL',async()=>{
  const w=worker({},async()=>({ok:true,json:async()=>({data:[{id:'model-z'},{id:'model-a'},{id:'model-a'},{other:1}]})}));
  const msg={type:'listModels',profile:{endpoint:'https://provider.example/v1',apiKey:'discovery-key',model:''}};
  assert.match((await w.send(msg)).error,/only available/);assert.equal(w.fetches,0);
  const r=await w.send(msg,'chrome-extension://test/options.html');assert.deepEqual(Array.from(r.models),['model-a','model-z']);assert.equal(w.calls[0].url,'https://provider.example/v1/models');assert.equal(w.calls[0].options.method,'GET');
});
test('connection test uses the draft profile without changing the saved active model',async()=>{
  const w=worker();const result=await w.send({type:'testConnection',profile:{endpoint:'https://test.example/v1',model:'test-model',apiKey:'draft-key'}},'chrome-extension://test/options.html');assert.equal(result.ok,true);assert.equal(w.sent.model,'test-model');assert.equal((await w.send({type:'settings'})).settings.modelLabel,'gpt-4.1-mini');
});
test('switching models in the page discards an in-flight result',async()=>{
  let resolve;
  const f=await automationFixture({autoSolve:false,profiles:[{id:'a',name:'A',model:'first'},{id:'b',name:'B',model:'second'}],activeProfileId:'a'},()=>new Promise(r=>resolve=r));
  try{f.$('ask').click();await wait(20);f.$('profile').value='b';f.$('profile').dispatchEvent(new f.w.Event('change'));await wait(20);resolve({result:{answer:'OLD MODEL',explanation:'',choiceIndexes:[1],uncertain:false}});await wait(20);assert.equal(f.$('result').hidden,true);assert.equal(f.$('profile').value,'b');assert.equal(f.clicks.length,0);}finally{f.close();}
});
test('fresh install and an empty saved profile list show clear setup state',async()=>{
  for(const profiles of [null,[]]){
    const f=await optionsFixture({apiKey:'',profiles});try{assert.equal(f.$('profiles').querySelectorAll('.profile-card').length,0);assert.equal(f.$('profileName').value,'');assert.equal(f.$('apiKey').value,'');assert.equal(f.$('deleteProfile').hidden,true);}finally{f.close();}
  }
});
test('unsafe URLs and string no-auth flags cannot bypass connection validation',async()=>{
  for(const endpoint of ['http://192.168.1.5/v1','https://user:pass@host.test/v1','https://host.test/v1?key=secret']){
    const w=worker({profiles:[{id:'x',name:'X',endpoint,model:'m',apiKey:'key'}],activeProfileId:'x'});assert.ok((await w.send({type:'solve',question:'x',choices:[]})).error);assert.equal(w.fetches,0);
  }
  const w=worker({profiles:[{id:'x',name:'X',endpoint:'https://host.test/v1',model:'m',apiKey:'',noKey:'true'}],activeProfileId:'x'});assert.match((await w.send({type:'solve',question:'x',choices:[]})).error,/API key/);assert.equal(w.fetches,0);
});

test('structured provider errors and cooldown avoid repeat quota requests',async()=>{
  const w=worker({},async()=>({ok:false,status:429,headers:{get:()=> '12'}}));
  const request={type:'solve',question:'2+2',choices:[]};
  const first=await w.send(request);assert.equal(first.code,'rate_limit');assert.equal(first.retryAfter,12);
  const second=await w.send(request);assert.equal(second.code,'rate_limit');assert.equal(w.fetches,1);
  for(const [status,code] of [[401,'auth'],[403,'auth'],[404,'not_found'],[503,'server']]){
    const r=await worker({},async()=>({ok:false,status})).send(request);assert.equal(r.code,code);assert.equal(r.error.includes('test-key'),false);
  }
  const network=await worker({},async()=>{throw Error('sensitive provider error');}).send(request);
  assert.equal(network.code,'network');assert.equal(network.error.includes('sensitive'),false);
  const malformed=await worker({},async()=>({ok:true,json:async()=>{throw Error();}})).send(request);assert.equal(malformed.code,'format');
});
test('stop aborts the matching tab request, rejects duplicates, and permits another request',async()=>{
  let started,signal;const began=new Promise(r=>started=r);
  const w=worker({},async(url,options)=>{signal=options.signal;started();return new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));});
  const request={type:'solve',question:'2+2',choices:[],requestId:'first'};
  const pending=w.send(request);await began;
  const duplicate=await w.send({...request,requestId:'second'});assert.equal(duplicate.code,'busy');assert.equal(w.fetches,1);
  await w.send({type:'cancelSolve',requestId:'wrong'});assert.equal(signal.aborted,false);
  await w.send({type:'cancelSolve',requestId:'first'},'chrome-extension://test/options.html');assert.equal(signal.aborted,false);
  await w.send({type:'cancelSolve',requestId:'first'});assert.equal((await pending).code,'cancelled');assert.equal(signal.aborted,true);
  const second=w.send({...request,requestId:'second'});await wait(5);assert.equal(w.fetches,2);await w.send({type:'cancelSolve',requestId:'second'});assert.equal((await second).code,'cancelled');
});
test('presets exclude secrets, validate unsafe imports and do not accept injected credentials',async()=>{
  const ctx=vm.createContext({URL,crypto:require('node:crypto').webcrypto});
  for(const file of ['shared.js','presets.js'])vm.runInContext(fs.readFileSync(path.join(base,file),'utf8'),ctx);
  const p={name:'A',provider:'custom',endpoint:'https://example.com/v1',model:'m',apiKey:'secret-key',noKey:false};
  const exported=ctx.Umime.exportPresets([p]);assert.equal(JSON.stringify(exported).includes('secret-key'),false);
  exported.profiles[0].apiKey='injected';const imported=ctx.Umime.importPresets(JSON.stringify(exported));assert.equal(imported[0].apiKey,'');assert.match(imported[0].endpoint,/chat\/completions$/);
  exported.profiles[0].endpoint='http://evil.test';assert.throws(()=>ctx.Umime.importPresets(JSON.stringify(exported)),/HTTPS/);
  assert.throws(()=>ctx.Umime.importPresets('{'),/valid JSON/);assert.throws(()=>ctx.Umime.importPresets('x'.repeat(100001)),/100 KB/);
});
test('Stop hides pending answers and pauses automatic retries',async()=>{
  let finish;const pending=new Promise(r=>finish=r);
  const f=await automationFixture({},async()=>{await pending;return {result:{answer:'4',explanation:'x',choiceIndexes:[1],uncertain:false}};});
  try{
    await wait(600);assert.equal(f.$('stop').hidden,false);f.$('stop').click();
    finish();await wait(30);assert.equal(f.$('result').hidden,true);assert.equal(f.$('stop').hidden,true);assert.equal(f.clicks.length,0);assert.match(f.$('auto').textContent,/Resume/);
    await wait(550);assert.equal(f.calls.length,1);
  }finally{f.close();}
});
test('Tools navigation and local diagnostics do not send keys or make API calls',async()=>{
  const f=await optionsFixture();try{
    f.w.document.querySelector('[data-tab=tools]').click();assert.equal(f.$('tab-tools').hidden,false);assert.equal(f.$('savebar').hidden,true);
    f.$('diagnose').click();await wait(30);assert.match(f.$('diagnostics').textContent,/API host access: granted/);assert.equal(f.$('diagnostics').textContent.includes('legacy-secret'),false);assert.equal(f.requests.length,0);
  }finally{f.close();}
});
test('toolbar handles a supported exercise and inaccessible tabs without broad permissions',async()=>{
  const {JSDOM}=require('jsdom');
  for(const accessible of [true,false]){
    const dom=new JSDOM(fs.readFileSync(path.join(base,'popup.html'),'utf8'),{runScripts:'outside-only',url:'https://extension.test'}),w=dom.window,actions=[];
    w.chrome={runtime:{sendMessage:async()=>({settings:{profiles:[{id:'a',name:'My model',model:'m'}],activeProfileId:'a',configured:true,autoSolve:false}}),openOptionsPage:async()=>{},getURL:x=>x},tabs:{query:async()=>[{id:1}],sendMessage:async(id,m)=>{actions.push(m.action);if(!accessible)throw Error('No receiver');return {ready:true,busy:false,configured:true,hasQuestion:true,choices:2,cached:1};}}};
    try{w.eval(fs.readFileSync(path.join(base,'popup.js'),'utf8'));await wait(20);assert.equal(w.document.getElementById('ask').disabled,!accessible);
      if(accessible){w.document.getElementById('clear').click();await wait(20);assert.ok(actions.includes('clearCache'));}else assert.match(w.document.getElementById('detail').textContent,/Refresh/);
    }finally{w.close();}
  }
  const manifest=JSON.parse(fs.readFileSync(path.join(base,'manifest.json')));assert.deepEqual(manifest.permissions,['storage']);assert.equal(manifest.action.default_popup,'popup.html');
});
test('import review preserves existing keys and selection, strips incoming keys, and requests no permissions',async()=>{
  const f=await optionsFixture();try{
    const data={format:'umime-helper-presets',version:1,profiles:[{name:'Imported',provider:'custom',endpoint:'https://other.example/v1',model:'model-b',noKey:false,apiKey:'injected-secret'}]};
    Object.defineProperty(f.$('importFile'),'files',{configurable:true,value:[{size:500,text:async()=>JSON.stringify(data)}]});
    await f.$('importFile').onchange();assert.equal(f.$('importReview').hidden,false);assert.equal(f.state.profiles,undefined);assert.match(f.$('importList').textContent,/other.example/);
    await f.$('confirmImport').onclick();assert.equal(f.state.profiles.length,2);assert.equal(f.state.profiles[0].apiKey,'legacy-secret');assert.equal(f.state.profiles[1].apiKey,'');assert.equal(f.state.activeProfileId,'legacy');assert.equal(f.state.apiKey,'');assert.equal(f.permissions.length,0);assert.equal(f.$('importReview').hidden,true);
    data.profiles[0].endpoint='http://remote.example/v1';await f.$('importFile').onchange();assert.equal(f.$('importReview').hidden,true);assert.equal(f.state.profiles.length,2);assert.match(f.$('status').textContent,/HTTPS/);
  }finally{f.close();}
});

test('vision payload contains inline images, concise prompts and a controlled output cap',async()=>{
  const profile={id:'vision',name:'Vision',endpoint:'https://provider.example/v1',model:'vision-model',apiKey:'key',vision:true,tokenField:'max_tokens'};
  const w=worker({profiles:[profile],activeProfileId:'vision',outputLimit:512},async()=>({ok:true,json:async()=>({usage:{prompt_tokens:700,completion_tokens:80,prompt_tokens_details:{cached_tokens:100}},choices:[{finish_reason:'stop',message:{content:JSON.stringify({answer:'4',explanation:'Shown in the image.',choiceIndexes:[],uncertain:false})}}]})}));
  const result=await w.send({type:'solve',question:'Read the image',choices:[],images:[{data:'data:image/jpeg;base64,YWJj',label:'Question image'}]});
  assert.equal(result.result.usage.total,780);assert.equal(w.sent.max_tokens,512);assert.equal(w.sent.messages[1].content[2].image_url.url,'data:image/jpeg;base64,YWJj');assert.equal(w.sent.messages[1].content[2].image_url.detail,'auto');
  const {usage}=await w.send({type:'usage'});assert.equal(usage.today.input,700);assert.equal(usage.today.output,80);assert.equal(usage.today.cached,100);assert.equal(usage.today.requests,1);
  assert.equal(JSON.stringify(usage).includes('Read the image'),false);
});
test('images require an explicitly enabled vision model and reject remote URLs or oversized payloads',async()=>{
  const w=worker(),message={type:'solve',question:'Read image',choices:[],images:[{data:'data:image/png;base64,YWJj',label:'Question image'}]};
  assert.equal((await w.send(message)).code,'vision');assert.equal(w.fetches,0);
  assert.equal((await w.send({...message,images:[{data:'https://private.example/image',label:'x'}]})).code,'images');
  assert.equal((await w.send({...message,images:Array(5).fill(message.images[0])})).code,'images');assert.equal(w.fetches,0);
});
test('usage separates missing usage, enforces daily limits, and does not double-count cached input',async()=>{
  const w=worker({dailyRequestLimit:1});const msg={type:'solve',question:'2+2',choices:[]};
  await w.send(msg);const {usage}=await w.send({type:'usage'});assert.equal(usage.today.unknown,1);assert.equal(usage.today.input,0);
  assert.equal((await w.send(msg)).code,'budget');assert.equal(w.fetches,1);
  assert.match((await w.send({type:'resetUsage'})).error,/Settings/);
  await w.send({type:'resetUsage'},'chrome-extension://test/options.html');assert.equal((await w.send({type:'usage'})).usage.today.requests,0);
  const tokens=worker({dailyTokenLimit:5},async()=>({ok:true,json:async()=>({usage:{prompt_tokens:8,completion_tokens:2},choices:[{message:{content:'{"answer":"4","explanation":"x","choiceIndexes":[],"uncertain":false}'}}]})}));
  await tokens.send(msg);assert.equal((await tokens.send(msg)).code,'budget');assert.equal(tokens.fetches,1);
});
test('truncated answers keep reported usage and explain the output cap instead of displaying partial JSON',async()=>{
  const w=worker({},async()=>({ok:true,json:async()=>({usage:{prompt_tokens:10,completion_tokens:128},choices:[{finish_reason:'length',message:{content:'{"answer":'}}]})}));
  const response=await w.send({type:'solve',question:'2+2',choices:[]});assert.equal(response.code,'output_limit');assert.equal((await w.send({type:'usage'})).usage.today.output,128);assert.equal(w.sent.max_completion_tokens,768);
});
test('simultaneous requests obey the shared request budget and usage resets wait for in-flight work',async()=>{
  let finish,started;const gate=new Promise(r=>started=r);const w=worker({dailyRequestLimit:1},async()=>{started();await new Promise(r=>finish=r);return {ok:true,json:async()=>({choices:[{message:{content:'{"answer":"4","explanation":"x","choiceIndexes":[],"uncertain":false}'}}]})};});
  const first=w.send({type:'solve',question:'x',choices:[]});await gate;
  const other=await w.send({type:'solve',question:'x',choices:[]},'chrome-extension://test/options.html');assert.equal(other.code,'budget');assert.equal(w.fetches,1);
  assert.match((await w.send({type:'resetUsage'},'chrome-extension://test/options.html')).error,/running requests/);finish();await first;
});
test('image extraction captures only exercise visuals and labels image-only choices',()=>{
  const {JSDOM}=require('jsdom');const dom=new JSDOM('<nav><img src="logo.png"></nav><div class="question-content"><img src="question.png"><canvas></canvas></div><div class="options"><button data-data="option"><img src="choice.png"></button></div>',{runScripts:'outside-only',url:'https://umimematiku.cz'}),w=dom.window;
  try{w.Element.prototype.getClientRects=()=>[{width:100,height:50}];for(const file of ['shared.js','extract.js','images.js'])w.eval(fs.readFileSync(path.join(base,file),'utf8'));
    const targets=w.Umime.imageTargets(w.document,w.Umime.defaults);assert.equal(targets.length,3);assert.equal(targets[2].label,'Choice 1 image');const data=w.Umime.extract(w.document,w.Umime.defaults);assert.equal(data.choices[0],'Choice 1 (image)');assert.equal(data.imageSignature.length,3);
  }finally{w.close();}
});
test('local image resize preserves aspect ratio, caps dimensions and uses a content hash',async()=>{
  const {JSDOM}=require('jsdom');const dom=new JSDOM('',{runScripts:'outside-only',url:'https://umimematiku.cz'}),w=dom.window;let canvas;
  try{w.Umime={};w.TextEncoder=TextEncoder;Object.defineProperty(w.crypto,'subtle',{value:require('node:crypto').webcrypto.subtle});
    const create=w.document.createElement.bind(w.document);w.document.createElement=tag=>{const el=create(tag);if(tag==='canvas'){canvas=el;el.getContext=()=>({fillRect(){},drawImage(){}});el.toDataURL=()=> 'data:image/jpeg;base64,YWJj';}return el;};
    w.eval(fs.readFileSync(path.join(base,'images.js'),'utf8'));const image=await w.Umime.resizeImage({naturalWidth:2400,naturalHeight:1200},1280);assert.equal(canvas.width,1280);assert.equal(canvas.height,640);assert.equal(image.hash.length,64);assert.equal(image.data,'data:image/jpeg;base64,YWJj');
    await assert.rejects(()=>w.Umime.uploadImage({type:'text/html',size:12},1280),/PNG/);
  }finally{w.close();}
});

test('panel attaches exercise images, reuses identical visual answers, and blocks unreadable pictures',async()=>{
  const f=await automationFixture({autoSolve:false,autoClick:false});
  try{
    f.w.Umime.captureImage=async()=>({data:'data:image/jpeg;base64,YWJj',hash:'abc',width:800,height:400});
    const img=f.w.document.createElement('img');img.src='https://umimematiku.cz/question.png';f.w.document.querySelector('.question-content').append(img);
    await wait(430);assert.equal(f.$('imageList').children.length,1);f.$('ask').click();await wait(30);
    assert.equal(f.calls[0].images.length,1);assert.equal(f.$('result').hidden,false);f.$('ask').click();await wait(30);assert.equal(f.calls.length,1);assert.match(f.$('usageLine').textContent,/Cache hit/);
    f.w.Umime.captureImage=async()=>{throw Error('Cross-origin image blocked');};img.src='https://cdn.example/blocked.png';await wait(430);f.$('ask').click();await wait(20);assert.equal(f.calls.length,1);assert.match(f.$('status').textContent,/Some images/);
    f.$('includeImages').checked=false;f.$('includeImages').dispatchEvent(new f.w.Event('change'));f.$('ask').click();await wait(30);assert.equal(f.calls.length,2);assert.equal(f.calls[1].images.length,0);
  }finally{f.close();}
});

test('hint request never returns selectable choices, uses a separate prompt and records its mode',async()=>{
  const w=worker();const r=await w.send({type:'solve',mode:'hint',question:'2+2?',choices:['3','4']});
  assert.equal(r.result.mode,'hint');assert.equal(r.result.choiceIndexes.length,0);assert.match(w.sent.messages[0].content,/Do NOT reveal/);
  const history=await w.send({type:'history'},'chrome-extension://test/options.html');assert.equal(history.entries[0].mode,'hint');assert.equal(history.entries[0].question,'2+2?');
});
test('hint-first reveals only on request, caches modes separately and never auto-clicks hints',async()=>{
  const f=await automationFixture({hintFirst:true},async m=>({result:{mode:m.mode,answer:m.mode==='hint'?'Try adding the two groups.':'4',explanation:'',choiceIndexes:m.mode==='hint'?[]:[1],uncertain:false}}));
  try{await wait(600);assert.equal(f.calls.length,1);assert.equal(f.calls[0].mode,'hint');assert.equal(f.clicks.length,0);assert.equal(f.$('reveal').hidden,false);assert.equal(f.$('confidence').textContent,'Hint');
    f.$('reveal').click();await wait(30);assert.equal(f.calls[1].mode,'answer');assert.equal(f.$('answer').textContent,'4');assert.equal(f.clicks.length,0);
    f.$('ask').click();await wait(30);assert.equal(f.$('confidence').textContent,'Hint');f.$('reveal').click();await wait(30);assert.equal(f.calls.length,2);
  }finally{f.close();}
});
test('hide removes the entire widget, preserves a ready answer and pauses until explicitly resumed',async()=>{
  const f=await automationFixture({autoSolve:false});try{
    f.$('ask').click();await wait(20);const answer=f.$('answer').textContent;
    f.$('hideAll').click();assert.equal(f.w.document.getElementById('umime-helper-extension').style.display,'none');assert.equal(f.panel('status').hidden,true);assert.equal(f.panel('status').paused,true);
    f.panel('show');assert.equal(f.w.document.getElementById('umime-helper-extension').style.display,'');assert.equal(f.$('panel').hidden,false);assert.equal(f.$('answer').textContent,answer);assert.equal(f.$('result').hidden,false);
  }finally{f.close();}
});
test('history is local, bounded, expires old entries, supports opt-out and rejects webpage access',async()=>{
  const w=worker({historyLimit:10,historyDays:1,historyEntries:[{id:'old',time:Date.now()-2*86400000,question:'Expired'}]});
  const internal='chrome-extension://test/options.html';assert.match((await w.send({type:'history'})).error,/Settings/);
  for(let i=0;i<12;i++)await w.send({type:'solve',question:'Question '+i,choices:[]});
  const {entries}=await w.send({type:'history'},internal);assert.equal(entries.length,10);assert.equal(entries[0].question,'Question 11');assert.equal(entries.some(e=>e.id==='old'),false);assert.equal(JSON.stringify(entries).includes('test-key'),false);assert.equal(JSON.stringify(entries).includes('https://'),false);
  assert.equal((await w.send({type:'settings'})).settings.historyEntries,undefined);
  await w.send({type:'deleteHistory',id:entries[0].id},internal);assert.equal((await w.send({type:'history'},internal)).entries.length,9);
  w.storage.historyEnabled=false;await w.send({type:'solve',question:'Do not store',choices:[]});assert.equal((await w.send({type:'history'},internal)).entries.length,9);
  await w.send({type:'clearHistory'},internal);assert.equal((await w.send({type:'history'},internal)).entries.length,0);
});
test('cost estimates use cached input rates once and retain currency totals',async()=>{
  const profile={id:'priced',name:'Priced model',endpoint:'https://provider.example/v1',model:'m',apiKey:'key',inputRate:'2',outputRate:'10',cachedRate:'0.5',currency:'USD'};
  const w=worker({profiles:[profile],activeProfileId:'priced'},async()=>({ok:true,json:async()=>({usage:{prompt_tokens:1000,completion_tokens:100,prompt_tokens_details:{cached_tokens:200}},choices:[{message:{content:'{"answer":"4","explanation":"x","choiceIndexes":[],"uncertain":false}'}}]})}));
  const r=await w.send({type:'solve',question:'2+2',choices:[]});assert.ok(Math.abs(r.result.cost.amount-.0027)<1e-10);assert.equal(r.result.cost.currency,'USD');
  const {usage}=await w.send({type:'usage'});assert.ok(Math.abs(usage.today.costs.USD-.0027)<1e-10);assert.equal(usage.today.unpriced,0);
  const history=await w.send({type:'history'},'chrome-extension://test/options.html');assert.equal(history.entries[0].cost.amount,r.result.cost.amount);
  const unknown=worker();const missing=await unknown.send({type:'solve',question:'x',choices:[]});assert.equal(missing.result.cost,null);assert.equal((await unknown.send({type:'usage'})).usage.today.unpriced,1);
});
test('history renders text safely, searches saved questions and hides answers behind details',async()=>{
  const f=await optionsFixture({historyEntries:[{id:'a',time:Date.now(),question:'<img src=x onerror=alert(1)> Algebra',model:'m',mode:'hint',answer:'Try factoring',explanation:'',choices:[],imageCount:0,cost:null,usage:null}]});
  try{f.w.document.querySelector('[data-tab=history]').click();await wait(20);assert.equal(f.$('tab-history').hidden,false);assert.equal(f.$('historyList').querySelector('img'),null);assert.equal(f.$('historyList').querySelector('details').open,false);
    f.$('historySearch').value='geometry';f.$('historySearch').dispatchEvent(new f.w.Event('input'));assert.equal(f.$('historyList').children.length,0);
    f.$('historySearch').value='algebra';f.$('historySearch').dispatchEvent(new f.w.Event('input'));assert.equal(f.$('historyList').children.length,1);
  }finally{f.close();}
});

test('minimal panel presents setup, hint and reveal as distinct next steps',async()=>{
  const f=await automationFixture({autoSolve:false,configured:false,hintFirst:true},async m=>({result:{mode:m.mode,answer:m.mode==='hint'?'Think about the groups.':'4',explanation:'',choiceIndexes:[],uncertain:false}}));
  try{assert.equal(f.$('setup').hidden,false);assert.equal(f.$('ask').hidden,true);assert.equal(f.$('more').open,false);assert.equal(f.$('source').open,false);assert.match(f.$('questionPreview').textContent,/2 \+ 2/);
    f.change({configured:true});await wait(20);assert.equal(f.$('setup').hidden,true);assert.equal(f.$('ask').hidden,false);
    f.$('ask').click();await wait(20);assert.equal(f.$('ask').hidden,true);assert.equal(f.$('reveal').hidden,false);
    f.$('reveal').click();await wait(20);assert.equal(f.$('ask').hidden,true);assert.equal(f.$('reveal').hidden,true);
    f.$('askAgain').click();assert.equal(f.$('ask').hidden,false);assert.equal(f.$('result').hidden,true);
  }finally{f.close();}
});
