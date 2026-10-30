import { API_ORIGIN, ApiError, validateMediaUrl } from './server-core';

export type MediaKind = 'audio' | 'video';
export type MediaFormat = { id: string; label: string; kind: MediaKind; ext: string; size: number | null };
type Fetcher = typeof fetch;
const TYPES: Record<string, { kind: MediaKind; ext: string }> = {
  'audio/mpeg': {kind:'audio',ext:'mp3'}, 'audio/mp3': {kind:'audio',ext:'mp3'},
  'audio/mp4': {kind:'audio',ext:'m4a'}, 'audio/aac': {kind:'audio',ext:'aac'},
  'audio/ogg': {kind:'audio',ext:'ogg'}, 'audio/webm': {kind:'audio',ext:'webm'},
  'audio/wav': {kind:'audio',ext:'wav'}, 'audio/x-wav': {kind:'audio',ext:'wav'},
  'video/mp4': {kind:'video',ext:'mp4'}, 'video/webm': {kind:'video',ext:'webm'},
  'video/ogg': {kind:'video',ext:'ogg'},
};
export function mediaType(response: Response) {
  return TYPES[(response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase()] || null;
}
export function streamUrl(url: string, kind: MediaKind) {
  const result = new URL('/api/v1/stream', API_ORIGIN);
  result.searchParams.set('url', url);
  result.searchParams.set('type', kind);
  return result.toString();
}
export function mediaSignal(signal?: AbortSignal | null, timeout = 40000) {
  const timer = AbortSignal.timeout(timeout);
  return signal ? combineSignals([signal, timer]) : timer;
}
export function combineSignals(signals: AbortSignal[]) {
  // workerd does not expose AbortSignal.any in every preview compatibility date.
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(signals);
  const controller=new AbortController();
  for(const signal of signals){
    if(signal.aborted){controller.abort(signal.reason);break;}
    signal.addEventListener('abort',()=>controller.abort(signal.reason),{once:true});
  }
  return controller.signal;
}
function safeImage(value: unknown) {
  if (typeof value !== 'string') return null;
  try { return validateMediaUrl(value); } catch { return null; }
}
export async function extraction(url: string, signal?: AbortSignal | null, fetcher: Fetcher = fetch) {
  const response = await fetcher(`${API_ORIGIN}/api/v1/extract`, {
    method:'POST', headers:{'Content-Type':'application/json','Accept':'application/json'},
    body:JSON.stringify({url}), redirect:'manual', signal:mediaSignal(signal),
  });
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || data?.success !== true) {
    const verification = data?.code === 'provider_verification_required';
    throw new ApiError(response.status === 429 ? 429 : verification ? 422 : 502,
      verification ? 'source_verification_required' : 'media_unavailable',
      verification ? 'This source requires verification that the media service cannot complete. Try another public media link.' :
      response.status === 429 ? 'The media service is busy. Please wait a moment and retry.' :
      'The media source could not be read. It may be unavailable, protected, or unsupported. Try the original public link.');
  }
  return {
    title: typeof data.title === 'string' && data.title.trim() ? data.title.slice(0,300) : 'Media download',
    thumbnail:safeImage(data.thumbnail),
    duration:typeof data.duration === 'number' && Number.isFinite(data.duration) ? data.duration : null,
    source:new URL(url).hostname.replace(/^www\./,''),
    platform:typeof data.platform === 'string' ? data.platform.slice(0,100) : null,
  };
}

// The live extraction API currently returns empty format lists for tested public
// sources. Only advertise a default output after this source's real HEAD response
// confirms a media MIME type. No bitrate/resolution parameters are assumed.
export async function probeFormat(url: string, kind: MediaKind, signal?: AbortSignal | null, fetcher: Fetcher = fetch): Promise<MediaFormat | null> {
  let response: Response;
  try {
    response = await fetcher(streamUrl(url,kind), {method:'HEAD',redirect:'manual',signal:mediaSignal(signal,30000)});
    if (response.status === 405) {
      response = await fetcher(streamUrl(url,kind), {method:'GET',redirect:'manual',signal:mediaSignal(signal,30000)});
      await response.body?.cancel();
    }
  } catch (error) { if (signal?.aborted) throw error; return null; }
  const type = mediaType(response);
  if (!response.ok || !type || type.kind !== kind) return null;
  const reported = Number(response.headers.get('content-length'));
  return {id:`${kind}:default:${type.ext}`,label:`${kind === 'audio' ? 'Audio' : 'Video'} · source default`,kind,ext:type.ext,
    size:Number.isSafeInteger(reported) && reported > 0 ? reported : null};
}
export async function analyzeMedia(url: string, signal?: AbortSignal | null, fetcher: Fetcher = fetch) {
  const metadata = await extraction(url,signal,fetcher);
  const formats = (await Promise.all([probeFormat(url,'video',signal,fetcher),probeFormat(url,'audio',signal,fetcher)]))
    .filter((format): format is MediaFormat => format !== null);
  return {...metadata,formats,
    formatNote:formats.length ? 'Only source-default outputs verified by the media service are shown. Specific quality levels are not reported.' :
    'This source returned metadata but no downloadable output could be verified. Try another public link.'};
}
export function selectedFormat(value: unknown) {
  if (typeof value !== 'string') throw new ApiError(400,'invalid_format','Select an available format first.');
  const match=/^(audio|video):default:(mp3|m4a|aac|ogg|webm|wav|mp4)$/.exec(value);
  if (!match) throw new ApiError(400,'invalid_format','This format is not available. Analyze your link again.');
  return {id:value,kind:match[1] as MediaKind,ext:match[2],label:`${match[1] === 'audio' ? 'Audio' : 'Video'} · source default`};
}
