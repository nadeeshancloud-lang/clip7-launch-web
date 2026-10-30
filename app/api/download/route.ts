import { ApiError, safeFilename, validateIdempotencyKey, validateMediaUrl } from '../../lib/server-core';
import { verifyFirebaseIdentity } from '../../lib/server-auth';
import { combineSignals, extraction, mediaType, selectedFormat, streamUrl } from '../../lib/server-media';
import { releaseDownload, reserveDownload, startReservedDownload } from '../../lib/server-db';
import { body, failure, requireSameOrigin } from '../../lib/server-http';
export const dynamic='force-dynamic';
export async function POST(request: Request) {
  let reservation: {id:string;generation:number} | null=null;
  let uid:string|null=null;
  let reader:ReadableStreamDefaultReader<Uint8Array>|null=null;
  let headerTimer:ReturnType<typeof setTimeout>|undefined;
  try {
    requireSameOrigin(request);
    const identity=await verifyFirebaseIdentity(request);uid=identity.uid;
    const input=await body(request);
    const url=validateMediaUrl(input.url),format=selectedFormat(input.formatId),key=validateIdempotencyKey(input.idempotencyKey);
    const metadata=await extraction(url,request.signal);
    reservation=await reserveDownload(uid,request,{key,source:metadata.source,title:metadata.title,formatId:format.id,formatLabel:format.label});
    const headerAbort=new AbortController();
    headerTimer=setTimeout(()=>headerAbort.abort(new DOMException('Media preparation timed out','TimeoutError')),60000);
    const response=await fetch(streamUrl(url,format.kind),{redirect:'manual',signal:combineSignals([request.signal,headerAbort.signal])});
    const actual=mediaType(response);
    if(!response.ok||!response.body||!actual||actual.kind!==format.kind||actual.ext!==format.ext){
      await response.body?.cancel();
      throw new ApiError(502,'format_unavailable','This output is no longer available from the source. Analyze the link again or choose another format.');
    }
    reader=response.body.getReader();
    const first=await reader.read();
    if(first.done||!first.value?.byteLength)throw new ApiError(502,'empty_download','The media service returned an empty file. Try another source or format.');
    if(request.signal.aborted)throw new DOMException('Transfer canceled','AbortError');
    clearTimeout(headerTimer);headerTimer=undefined;
    await startReservedDownload(uid,reservation);
    const upstream=reader;
    let initial:Uint8Array|null=first.value;
    const stream=new ReadableStream<Uint8Array>({
      async pull(controller){try{if(initial){controller.enqueue(initial);initial=null;return;}const next=await upstream.read();if(next.done){upstream.releaseLock();controller.close();}else controller.enqueue(next.value);}catch(error){controller.error(error);}},
      async cancel(){await upstream.cancel();},
    });
    const filename=safeFilename(metadata.title,actual.ext);
    const headers:Record<string,string>={'Content-Type':response.headers.get('content-type')!,
      'Content-Disposition':`attachment; filename="${filename.replace(/[^\x20-\x7e]/g,'_')}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
    const size=response.headers.get('content-length');if(size&&/^\d+$/.test(size))headers['Content-Length']=size;
    return new Response(stream,{headers});
  }catch(error){
    if(headerTimer)clearTimeout(headerTimer);
    if(reader)await reader.cancel().catch(()=>{});
    if(uid&&reservation)await releaseDownload(uid,reservation.id,request.signal.aborted).catch(()=>{});
    return failure(error);
  }
}
