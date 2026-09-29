const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/workflow/workflow.js'), 'utf8');
const endpoints = {'openai-chat':'/api/openai/responses','anthropic-chat':'/api/anthropic/messages','google-chat':'/api/gemini/generate'};
const modelOptions = source.slice(source.indexOf('const TEXT_MODEL_OPTIONS ='), source.indexOf('const TEXT_NODE_ENDPOINTS ='));
const functions = source.slice(source.indexOf('async function executeTextAiNode('), source.indexOf('function confirmAgentOutput('));
async function run(provider) {
  let request;
  const context = vm.createContext({
    TEXT_NODE_ENDPOINTS:endpoints, Intl, Date, console,
    assetToDataUrl:()=>assert.fail('Unexpected attachment'),
    getSelectedProject:()=>({}), getDirectStoryboardEditContext:()=>null,
    ensureWorkflow:()=>({edges:[],nodes:[]}), getAgentProvider:()=>provider,
    collectSourceOutputs:()=>[], renderNodes(){},renderInspector(){},persistWorkflow(){},
    createId:()=> 'test', getRememberedAgentModel:()=>vm.runInContext(`TEXT_MODEL_OPTIONS['${provider}'][0][0]`,context),
    fetch:async (endpoint, options)=> {
      request = JSON.parse(options.body);
      assert.equal(request.webSearch,true);
      assert.match(request.instructions,/웹 검색/);
      if (process.argv.includes('--live')) return fetch('http://localhost:8055'+endpoint, {...options,signal:AbortSignal.timeout(180000)});
      return {ok:true,json:async()=>({outputText:'테스트 날씨',searched:true,sources:[{url:'https://example.com/weather',title:'날씨'}]})};
    }
  });
  vm.runInContext(modelOptions + functions,context);
  const node = {type:'conversational-agent',config:{draftMessage:'서울의 오늘 날씨를 웹 검색으로 확인하고 기준 날짜와 출처를 짧게 알려줘.',messages:[]}};
  await context.sendAgentMessage(node);
  const answer = node.config.messages.at(-1);
  assert.ok(answer.searched, provider+' did not search');
  assert.ok(Array.isArray(answer.sources));
  if (!process.argv.includes('--live')) assert.equal(answer.sources.length, 1);
  assert.equal(node.execution.status,'waiting-review');
  console.log(JSON.stringify({provider,model:request.model,searched:answer.searched,sources:answer.sources.length}));
}
Promise.all(Object.keys(endpoints).filter(provider=>!process.argv.includes('--openai-only') || provider==='openai-chat').map(run)).catch(error=>{console.error(error);process.exitCode=1;});
