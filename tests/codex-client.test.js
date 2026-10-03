const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");
const ts = require("typescript");

function requireTypeScript(file) {
  const source = fs.readFileSync(file, "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: file,
  }).outputText;
  const mod = new Module(file, module);
  mod.filename = file;
  mod.paths = Module._nodeModulePaths(path.dirname(file));
  mod._compile(compiled, file);
  return mod.exports;
}

const {
  buildCodexNewThreadUrl,
  buildCodexThreadUrl,
  CodexAppServerClient,
  JsonLineRpcPeer,
  openCodexNewThread,
  resolveCodexBin,
} = requireTypeScript(path.resolve(__dirname, "..", "codex-client.ts"));

test('lost completion event is reconciled with the exact persisted turn', async () => {
  const client = new CodexAppServerClient('codex', process.cwd());
  client.initialize = async () => {};
  client.threadId = 't'; client.turnId = 'u';
  const done = new Promise(resolve => client.completionResolve = resolve);
  client.peer = { request: async (method, params) => {
    assert.equal(method, 'thread/read');
    assert.deepEqual(params, { threadId: 't', includeTurns: true });
    return { thread: { id: 't', turns: [{ id: 'other', status: 'completed' }, { id: 'u', status: 'interrupted', items: [] }] } };
  } };
  await client.reconcileTurn();
  assert.equal((await done).status, 'interrupted');
});

test('reconciliation recovers final JSON without commentary', async () => {
  const client = new CodexAppServerClient('codex', process.cwd());
  client.initialize = async () => {};
  client.threadId = 't'; client.turnId = 'u';
  const done = new Promise(resolve => client.completionResolve = resolve);
  client.peer = { request: async () => ({ thread: { id: 't', turns: [{ id: 'u', status: 'completed', items: [
    { id: 'c', type: 'agentMessage', phase: 'commentary', text: 'working' },
    { id: 'f', type: 'agentMessage', phase: 'final_answer', text: '{"status":"ready"}' }
  ] }] } }) };
  await client.reconcileTurn();
  assert.equal((await done).output, '{"status":"ready"}');
});

test('read failures and unrelated turns cannot turn live work into success or failure', async () => {
  const client = new CodexAppServerClient('codex', process.cwd());
  client.initialize = async () => {};
  client.threadId = 't'; client.turnId = 'u';
  let settled = false;
  client.completionResolve = () => { settled = true; };
  client.peer = { request: async () => { throw Error('temporary read failure'); } };
  await client.reconcileTurn();
  client.peer.request = async () => ({ thread: { id: 't', turns: [{id:'other',status:'completed'}] } });
  await client.reconcileTurn();
  client.handleMessage({method:'turn/completed',params:{threadId:'t',turn:{id:'other',status:'completed'}}});
  assert.equal(settled, false);
});

test("Codex desktop new-thread link preserves an absolute folder with spaces", () => {
  const url = new URL(buildCodexNewThreadUrl("C:\\project with spaces"));
  assert.equal(url.protocol, "codex:");
  assert.equal(url.host, "threads");
  assert.equal(url.pathname, "/new");
  assert.equal(url.searchParams.get("path"), "C:\\project with spaces");
});

test("Codex desktop thread link targets the exact persistent task", () => {
  assert.equal(
    buildCodexThreadUrl("thread/new with spaces"),
    "codex://threads/thread%2Fnew%20with%20spaces",
  );
  assert.doesNotMatch(openCodexNewThread.toString(), /--open-project|--user-data-dir|SendKeys/);
  assert.match(openCodexNewThread.toString(), /client\.createThread\(threadName\)/);
  assert.doesNotMatch(openCodexNewThread.toString(), /verificationPrompt|read-only command/);
});

test("JsonLineRpcPeer parses fragmented JSON lines and correlates responses", async () => {
  const writes = [];
  const notifications = [];
  const peer = new JsonLineRpcPeer((line) => writes.push(line), (message) => notifications.push(message));
  const pending = peer.request("model/list", { limit: 10 });
  const request = JSON.parse(writes[0]);

  peer.feed('{"method":"turn/started","params":{"turn":');
  peer.feed('{"id":"turn-1"}}}\n{"id":' + request.id + ',"result":{"data":[]}}\n');

  assert.equal(notifications[0].method, "turn/started");
  assert.deepEqual(await pending, { data: [] });
});

test("JsonLineRpcPeer rejects an RPC error and ignores malformed lines", async () => {
  const writes = [];
  const notifications = [];
  const peer = new JsonLineRpcPeer((line) => writes.push(line), (message) => notifications.push(message));
  const pending = peer.request("thread/start");
  const request = JSON.parse(writes[0]);
  peer.feed('not-json\n{"id":' + request.id + ',"error":{"code":-1,"message":"not signed in"}}\n');
  await assert.rejects(pending, /not signed in/);
  assert.deepEqual(notifications, []);
});

test("Codex client accumulates final output and resolves turn completion", async () => {
  const snapshots = [];
  const client = new CodexAppServerClient("codex", process.cwd(), { onOutput: (output) => snapshots.push(output) });
  client.threadId = "thread-1";
  client.turnId = "turn-1";
  const completed = new Promise((resolve, reject) => {
    client.completionResolve = resolve;
    client.completionReject = reject;
  });
  client.handleMessage({ method: "item/agentMessage/delta", params: { delta: "Hello " } });
  client.handleMessage({ method: "item/agentMessage/delta", params: { delta: "world" } });
  client.handleMessage({ method: "turn/completed", params: { turn: { id: "turn-1", status: "completed" } } });

  assert.deepEqual(snapshots, ["Hello ", "Hello world"]);
  assert.deepEqual(await completed, {
    output: "Hello world",
    threadId: "thread-1",
    turnId: "turn-1",
    status: "completed",
    error: undefined,
  });
});

test("Codex client creates a persistent empty thread for the desktop launcher", async () => {
  const requests = [];
  const client = new CodexAppServerClient("codex", "C:\\project with spaces");
  client.initialized = true;
  client.peer = {
    request: async (method, params) => {
      requests.push({ method, params });
      return { thread: { id: "thread-new" } };
    },
  };

  assert.equal(await client.createThread("project with spaces"), "thread-new");
  assert.deepEqual(requests, [
    {
      method: "thread/start",
      params: {
        cwd: "C:\\project with spaces",
        approvalPolicy: "on-request",
        sandbox: "workspace-write",
        ephemeral: false,
        serviceName: "AutoOC",
      },
    },
    {
      method: "thread/inject_items",
      params: {
        threadId: "thread-new",
        items: [{
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "" }],
        }],
      },
    },
    {
      method: "thread/name/set",
      params: { threadId: "thread-new", name: "project with spaces" },
    },
  ]);
});

test("Codex run applies the requested approval policy to thread and turn", async () => {
  const requests = [];
  const client = new CodexAppServerClient("codex", process.cwd());
  client.initialized = true;
  client.peer = {
    request: async (method, params) => {
      requests.push({ method, params });
      if (method === "thread/start") return { thread: { id: "thread-background" } };
      if (method === "turn/start") return { turn: { id: "turn-background" } };
      return {};
    },
  };

  const completion = client.run("background task", "gpt-test", "medium", "never");
  await new Promise((resolve) => setImmediate(resolve));
  client.handleMessage({ method: "turn/completed", params: { turn: { id: "turn-background", status: "completed" } } });
  await completion;

  assert.equal(requests[0].params.approvalPolicy, "never");
  assert.equal(requests[1].params.approvalPolicy, "never");
});

test("Codex approval requests can be accepted or rejected", () => {
  const responses = [];
  const approvals = [];
  const client = new CodexAppServerClient("codex", process.cwd(), { onApproval: (approval) => approvals.push(approval) });
  client.peer = { respond: (id, result) => responses.push({ id, result }) };
  client.handleMessage({ id: 41, method: "item/commandExecution/requestApproval", params: { command: "npm test" } });
  client.handleMessage({ id: 42, method: "item/fileChange/requestApproval", params: { reason: "edit file" } });

  assert.equal(approvals.length, 2);
  assert.equal(client.resolveApproval(41, true), true);
  assert.equal(client.resolveApproval(42, false), true);
  assert.deepEqual(responses, [
    { id: 41, result: { decision: "accept" } },
    { id: 42, result: { decision: "decline" } },
  ]);
});

test("Codex interrupt uses thread and turn identifiers before disposal", async () => {
  const requests = [];
  let killed = false;
  const client = new CodexAppServerClient("codex", process.cwd());
  client.threadId = "thread-1";
  client.turnId = "turn-1";
  client.peer = {
    request: async (method, params) => requests.push({ method, params }),
    rejectAll() {},
  };
  client.child = { kill: () => { killed = true; } };
  await client.interrupt();
  assert.deepEqual(requests, [{ method: "turn/interrupt", params: { threadId: "thread-1", turnId: "turn-1" } }]);
  assert.equal(killed, true);
});

test("Codex auto-detection prefers the configured path", () => {
  assert.equal(resolveCodexBin("C:\\tools\\codex.exe"), "C:\\tools\\codex.exe");
});


test("Codex final item replaces interrupted or replayed deltas and excludes commentary", async () => {
  const snapshots=[];
  const client=new CodexAppServerClient('codex',process.cwd(),{onOutput:t=>snapshots.push(t)});
  client.threadId='t';client.turnId='u';
  const complete=new Promise(resolve=>client.completionResolve=resolve);
  const send=(method,params)=>client.handleMessage({method,params:{threadId:'t',turnId:'u',...params}});
  send('item/started',{item:{id:'progress',type:'agentMessage',phase:'commentary',text:''}});
  send('item/agentMessage/delta',{itemId:'progress',delta:'Checking files.'});
  send('item/completed',{item:{id:'progress',type:'agentMessage',phase:'commentary',text:'Checking files.'}});
  send('item/started',{item:{id:'answer',type:'agentMessage',phase:'final_answer',text:''}});
  send('item/agentMessage/delta',{itemId:'answer',delta:'{"status":"ok","planMarkdown":"Cut off'});
  const answer=JSON.stringify({status:'ok',planMarkdown:'Complete plan — café'});
  send('item/agentMessage/delta',{itemId:'answer',delta:answer});
  send('item/completed',{item:{id:'answer',type:'agentMessage',phase:'final_answer',text:answer}});
  send('item/completed',{item:{id:'answer',type:'agentMessage',phase:'final_answer',text:answer}});
  send('turn/completed',{turn:{id:'u',status:'completed'}});
  assert.equal((await complete).output,answer);
  assert.equal(snapshots.at(-1),'Checking files.\n\n'+answer);
});

test("Codex preserves separate legacy messages and completion without deltas", async () => {
  const client=new CodexAppServerClient('codex',process.cwd());
  const done=new Promise(resolve=>client.completionResolve=resolve);
  client.handleMessage({method:'item/agentMessage/delta',params:{itemId:'one',delta:'Progress'}});
  client.handleMessage({method:'item/completed',params:{item:{id:'one',type:'agentMessage',text:'Progress corrected'}}});
  client.handleMessage({method:'item/completed',params:{item:{id:'two',type:'agentMessage',text:'{"status":"ok"}'}}});
  client.handleMessage({method:'turn/completed',params:{turn:{status:'completed'}}});
  assert.equal((await done).output,'Progress corrected\n\n{"status":"ok"}');
});

test("Codex keeps multiple complete final messages distinct instead of guessing a winner", async () => {
  const client=new CodexAppServerClient('codex',process.cwd());
  const done=new Promise(resolve=>client.completionResolve=resolve);
  for(const id of ['one','two'])client.handleMessage({method:'item/completed',params:{item:{id,type:'agentMessage',phase:'final_answer',text:JSON.stringify({status:id})}}});
  client.handleMessage({method:'turn/completed',params:{turn:{status:'completed'}}});
  assert.equal((await done).output,'{"status":"one"}\n\n{"status":"two"}');
});

test('Codex persists thread identity before turn/start and refuses effects when persistence fails',async()=>{
  const events=[];
  const client=new CodexAppServerClient('unused',process.cwd(),{onThreadCreated:async({threadId})=>{events.push('saved:'+threadId);throw Error('disk unavailable');}});
  client.initialize=async()=>{};
  client.peer={request:async(method)=>{events.push(method);if(method==='thread/start')return {thread:{id:'durable-thread'}};throw Error('must not start turn');}};
  await assert.rejects(client.run('fixture'),/disk unavailable/);
  assert.deepEqual(events,['thread/start','saved:durable-thread']);
  assert.equal(client.getIds().threadId,'durable-thread');
});

test('Codex awaits durable turn identity before reporting an already completed turn',async()=>{
  let release,saved=false;
  const client=new CodexAppServerClient('unused',process.cwd(),{onStarted:async ids=>{assert.deepEqual(ids,{threadId:'t',turnId:'u'});await new Promise(resolve=>{release=resolve;});saved=true;}});
  client.initialize=async()=>{};
  client.peer={request:async method=>{
    if(method==='thread/start')return {thread:{id:'t'}};
    client.completionResolve({threadId:'t',turnId:'u',output:'done',status:'completed'});
    client.completionResolve=undefined;
    return {turn:{id:'u'}};
  }};
  let resolved=false;const pending=client.run('fixture').then(result=>{resolved=true;return result;});
  while(!release)await new Promise(resolve=>setImmediate(resolve));
  assert.equal(resolved,false);release();assert.equal((await pending).output,'done');assert.equal(saved,true);
});

test('external reconciliation reads only the exact saved turn without launching work',async()=>{
  const client=new CodexAppServerClient('unused',process.cwd());
  client.initialize=async()=>{};
  const calls=[];let thread={id:'saved-thread',turns:[{id:'saved-turn',status:'inProgress',items:[]}]};
  client.peer={request:async(method,params)=>{calls.push(method);assert.equal(params.threadId,'saved-thread');return {thread};}};
  assert.equal((await client.readExistingTurn('saved-thread','saved-turn')).status,'inProgress');
  thread={id:'different',turns:[]};await assert.rejects(client.readExistingTurn('saved-thread','saved-turn'),/mismatch/);
  thread={id:'saved-thread',turns:[{id:'other',status:'completed'}]};await assert.rejects(client.readExistingTurn('saved-thread','saved-turn'),/unavailable/);
  await assert.rejects(client.readExistingTurn('saved-thread',''),/identities/);
  assert.deepEqual(calls,['thread/read','thread/read','thread/read']);
  assert.deepEqual(client.getIds(),{threadId:'',turnId:''});
});
