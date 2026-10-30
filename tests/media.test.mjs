import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeMedia, probeFormat, selectedFormat, mediaType, streamUrl } from '../app/lib/server-media.ts';
import { verifyFirebaseIdentity } from '../app/lib/server-auth.ts';

const source='https://download.blender.org/peach/trailer/trailer_400p.ogg';
test('empty upstream arrays only become choices after real media HEAD confirmation', async()=>{
  const calls=[];
  const fetcher=async(url,options)=>{
    calls.push({url:String(url),method:options.method});
    if(options.method==='POST')return Response.json({success:true,title:'Real source title',duration:33,thumbnail:'javascript:alert(1)',video_formats:[],audio_formats:[]});
    const type=new URL(url).searchParams.get('type');
    return type==='audio'?new Response(null,{headers:{'content-type':'audio/mpeg','content-length':'793197'}}):Response.json({error:'No video'},{status:502});
  };
  const result=await analyzeMedia(source,null,fetcher);
  assert.equal(result.title,'Real source title');
  assert.equal(result.thumbnail,null);
  assert.deepEqual(result.formats,[{id:'audio:default:mp3',label:'Audio · source default',kind:'audio',ext:'mp3',size:793197}]);
  assert.equal(calls.length,3);
  assert(calls.every(c=>new URL(c.url).origin==='https://vurix-amila-api-658652589590.europe-west1.run.app'));
  assert(!JSON.stringify(result).includes('192'),'no invented bitrate');
});
test('HTML, JSON, wrong media kind and missing formats are not advertised',async()=>{
  for(const response of [new Response(null,{headers:{'content-type':'text/html'}}),new Response(null,{headers:{'content-type':'audio/mpeg'}}),new Response(null,{status:403})]){
    assert.equal(await probeFormat(source,'video',null,async()=>response),null);
  }
  assert.equal(mediaType(new Response(null,{headers:{'content-type':'application/octet-stream'}})),null);
  assert.throws(()=>selectedFormat('1080p'),{status:400});
  assert.equal(selectedFormat('audio:default:mp3').kind,'audio');
});
test('HEAD unsupported fallback cancels the GET body instead of consuming the file',async()=>{
  let canceled=false;
  const fetcher=async(_,options)=>options.method==='HEAD'?new Response(null,{status:405}):new Response(new ReadableStream({cancel(){canceled=true;}}),{headers:{'content-type':'video/mp4','content-length':'1234'}});
  const result=await probeFormat(source,'video',null,fetcher);
  assert.equal(result.ext,'mp4');assert.equal(canceled,true);
});
test('source verification failures remain real errors and URL query is encoded',async()=>{
  await assert.rejects(()=>analyzeMedia(source,null,async()=>Response.json({success:false,code:'provider_verification_required'},{status:422})),{status:422,code:'source_verification_required'});
  const target=new URL(streamUrl(source+'?a=1&b=2','audio'));
  assert.equal(target.searchParams.get('url'),source+'?a=1&b=2');
  assert.equal(target.searchParams.get('type'),'audio');
});
test('Firebase identity rejects a forged signature even when every claim is valid',async()=>{
  const pair=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.publicKey);jwk.kid='test-signing-key';
  const original=globalThis.fetch;
  globalThis.fetch=async()=>Response.json({keys:[jwk]},{headers:{'cache-control':'max-age=300'}});
  const b64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  const now=Math.floor(Date.now()/1000);
  const header=b64({alg:'RS256',kid:jwk.kid});
  const claims=b64({sub:'verified-user',aud:'clip-sevan',iss:'https://securetoken.google.com/clip-sevan',iat:now,auth_time:now,exp:now+3600,firebase:{sign_in_provider:'google.com'}});
  const message=`${header}.${claims}`;
  const signed=Buffer.from(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pair.privateKey,new TextEncoder().encode(message))).toString('base64url');
  try{
    const valid=new Request('https://clip7.test/api/download',{headers:{authorization:`Bearer ${message}.${signed}`}});
    assert.equal((await verifyFirebaseIdentity(valid)).uid,'verified-user');
    const forged=new Request('https://clip7.test/api/download',{headers:{authorization:`Bearer ${message}.${Buffer.alloc(256).toString('base64url')}`}});
    await assert.rejects(()=>verifyFirebaseIdentity(forged),{status:401});
  }finally{globalThis.fetch=original;}
});
